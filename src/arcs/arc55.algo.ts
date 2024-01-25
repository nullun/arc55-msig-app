import { Contract } from "@algorandfoundation/tealscript";

type TransactionGroup = {
    nonce: uint64,
    index: uint8
};

type TransactionSignatures = {
    nonce: uint64,
    address: Address
};

export class ARC55 extends Contract {
    programVersion = 10;

    // ============ State Variables ============
    // Number of signatures requires
    _threshold = GlobalStateKey<uint64>({});

    // Incrementing nonce for separating different groups of transactions
    _nonce = GlobalStateKey<uint64>({});

    // Transactions
    _transactions = BoxMap<TransactionGroup, bytes>({});

    // Signatures
    _signatures = BoxMap<TransactionSignatures, bytes64[]>({});

    // Signers
    _indexToAddress = GlobalStateMap<uint64, Address>({ maxKeys: 31, allowPotentialCollisions: true });
    _addressCount = GlobalStateMap<Address, uint64>({ maxKeys: 31, allowPotentialCollisions: true });


    // ============ Events ============
    /**
     * Emitted when a new transaction is added to a transaction group
     */
    TransactionAdded = new EventLogger<{
        /* Transaction Group nonce */
        transactionGroup: uint64,
        /* Index of transaction within group */
        transactionIndex: uint8
    }>();

    /**
     * Emitted when a transaction has been removed from a transaction group
     */
    TransactionRemoved = new EventLogger<{
        /* Transaction Group nonce */
        transactionGroup: uint64,
        /* Index of transaction within group */
        transactionIndex: uint8
    }>();

    /**
     * Emitted when a new signature is added to a transaction group
     */
    SignatureSet = new EventLogger<{
        /* Transaction Group nonce */
        transactionGroup: uint64,
        /* Address of signature */
        signer: Address
    }>();

    /**
     * Emitted when a signature has been removed from a transaction group
     */
    SignatureCleared = new EventLogger<{
        /* Transaction Group nonce */
        transactionGroup: uint64,
        /* Address of signature */
        signer: Address
    }>();


    // ============ Access Checks ============
    /**
     * Check the transaction sender is a signer for the multisig
     */
    protected onlySigner(): void {
        assert(this._addressCount(this.txn.sender).exists);
    }

    /**
     * Check the transaction sender is the contract creator
     */
    protected onlyCreator(): void {
        assert(this.txn.sender === globals.creatorAddress);
    }


    // ============ Read Only ============
    /**
     * Retrieve the signature threshold required for the multisignature to be submitted
     * @returns Multisignature threshold
     */
    @abi.readonly
    arc55_threshold(): uint64 {
        return this._threshold.value;
    }

    /**
     * Retrieve a transaction from a given transaction group
     * @param transactionGroup Transaction Group nonce
     * @param transactionIndex Index of transaction within group
     * @returns A single transaction at the specified index for the transaction group nonce
     */
    @abi.readonly
    arc55_transaction(transactionGroup: uint64, transactionIndex: uint8): bytes {
        const transactionBox: TransactionGroup = {
            nonce: transactionGroup,
            index: transactionIndex
        };

        return this._transactions(transactionBox).value;
    }

    /**
     * Retrieve a list of signatures for a given transaction group nonce and address
     * @param transactionGroup Transaction Group nonce
     * @param signer Address you want to retrieve signatures for
     * @returns Array of signatures
     */
    @abi.readonly
    arc55_signatures(transactionGroup: uint64, signer: Address): bytes64[] {
        const signatureBox: TransactionSignatures = {
            nonce: transactionGroup,
            address: signer
        };

        return this._signatures(signatureBox).value;
    }

    /**
     * Find out which address is at this index of the multisignature
     * @param index Address at this index of the multisignature
     * @returns Address at index
     */
    @abi.readonly
    arc55_signerByIndex(index: uint64): Address {
        return this._indexToAddress(index).value;
    }

    /**
     * Check if an address is a member of the multisignature
     * @param address Address to check is a signer
     * @returns True if address is a signer
     */
    @abi.readonly
    arc55_isSigner(address: Address): boolean {
        return this._addressCount(address).value !== 0;
    }

    /**
     * Calculate the minimum balance requirement for storing a signature
     * @param signaturesSize Size (in bytes) of the signatures to store
     * @returns Minimum balance requirement increase
     */
    @abi.readonly
    arc55_mbrSigIncrease(signaturesSize: uint64): uint64 {
        const currentBalance = this.app.address.balance;
        const minimumBalance = this.app.address.minBalance;

        // signatureBox costs:
        // + Name: uint64 + address = 8 + 32 = 40
        // + Body: abi + bytes = 2 + 64 * signatures.length
        const mbrSigRequired = (2500) + (400 * (40 + 2 + (64 * signaturesSize)));

        const newMinimumBalance = minimumBalance + mbrSigRequired;
        if (currentBalance > newMinimumBalance) {
            return 0;
        }

        return newMinimumBalance - currentBalance;
    }

    /**
     * Calculate the minimum balance requirement for storing a transaction
     * @param transactionSize Size (in bytes) of the transaction to store
     * @returns Minimum balance requirement increase
     */
    @abi.readonly
    arc55_mbrTxnIncrease(transactionSize: uint64): uint64 {
        const currentBalance = this.app.address.balance;
        const minimumBalance = this.app.address.minBalance;

        // transactionBox costs:
        // + Name: uint64 + uint8 = 8 + 1 = 9
        // + Body: transaction.length
        const mbrTxnRequired = (2500) + (400 * (9 + transactionSize));

        const newMinimumBalance = minimumBalance + mbrTxnRequired;
        if (currentBalance > newMinimumBalance) {
            return 0;
        }

        return newMinimumBalance - currentBalance;
    }


    // ============ External Functions ============
    /**
     * Setup On-Chain Msig App. This can only be called whilst no transaction groups have been created.
     * @param threshold Initial multisig threshold, must be greater than 0
     * @param addresses Array of addresses that make up the multisig
     */
    arc55_setup(
        threshold: uint8,
        addresses: Address[]
    ): void {
        assert(!this._nonce.value);
        this.onlyCreator();

        const t: uint64 = btoi(rawBytes(threshold));
        assert(t);
        this._threshold.value = t;

        this._nonce.value = 0;

        let index = 0;
        let address: Address;
        while (index < addresses.length) {
            address = addresses[index];

            // Store multisig index as key with address as value
            this._indexToAddress(index).value = address;

            // Store address as key and counter as value, this is for
            // ease of authentication, and tracking removal
            this._addressCount(address).value = this._addressCount(address).value + 1;

            index = index + 1;
        }
    }

    /**
     * Generate a new transaction group nonce for holding pending transactions
     * @returns transactionGroup Transaction Group nonce
     */
    arc55_newTransactionGroup(): uint64 {
        this.onlySigner();

        const n = this._nonce.value + 1;
        this._nonce.value = n;

        return n;
    }

    /**
     * Add a transaction to an existing group. Only one transaction should be included per call
     * @param costs Minimum Balance Requirement for associated box storage costs: (2500) + (400 * (9 + transaction.length))
     * @param transactionGroup Transaction Group nonce
     * @param index Transaction position within atomic group to add
     * @param transaction Transaction to add
     */
    arc55_addTransaction(
        costs: PayTxn,
        transactionGroup: uint64,
        index: uint8,
        transaction: bytes
    ): void {
        this.onlySigner();

        assert(transactionGroup);
        assert(transactionGroup <= this._nonce.value);

        const transactionBox: TransactionGroup = {
            nonce: transactionGroup,
            index: index,
        };

        // If there are additional addTransactionContinued transactions
        // following this transaction, concatenate all additional data.
        // TODO: Store in box at each iteration
        let transactionData = transaction;
        let groupPosition = this.txn.groupIndex + 1;
        if (groupPosition < globals.groupSize) {
            do {
                if (
                    this.txnGroup[groupPosition].applicationID === this.txn.applicationID
                    && this.txnGroup[groupPosition].applicationArgs[0] === method("arc55_addTransactionContinued(byte[])void")
                ) {
                    transactionData += extract3(this.txnGroup[groupPosition].applicationArgs[1], 2, 0);
                }
                groupPosition += 1;
            } while (groupPosition < globals.groupSize);
        }

        const mbrTxnIncrease = this.arc55_mbrTxnIncrease(transactionData.length);

        verifyTxn(costs, {
            receiver: this.app.address,
            amount: { greaterThanEqualTo: mbrTxnIncrease }
        });

        // Store transaction in box
        //const num = this._convertIndexToNumber(index);
        this._transactions(transactionBox).value = transactionData;

        // Emit event
        this.TransactionAdded.log({
            transactionGroup: transactionGroup,
            transactionIndex: index
        });
    }

    arc55_addTransactionContinued(
        transaction: bytes
    ): void {
        this.onlySigner();
    }

    /**
     * Remove transaction from the app. The MBR associated with the transaction will be returned to the transaction sender.
     * @param transactionGroup Transaction Group nonce
     * @param index Transaction position within atomic group to remove
     */
    arc55_removeTransaction(
        transactionGroup: uint64,
        index: uint8
    ): void {
        this.onlySigner();

        const transactionBox: TransactionGroup = {
            nonce: transactionGroup,
            index: index,
        };

        const txnLength = this._transactions(transactionBox).size;
        this._transactions(transactionBox).delete;

        // transactionBox costs:
        // + Name: uint64 + uint8 = 8 + 1 = 9
        // + Body: txnLength
        const mbrTxnDecrease = (2500) + (400 * (9 + txnLength));

        sendPayment({
            receiver: this.txn.sender,
            amount: mbrTxnDecrease
        });

        // Emit event
        this.TransactionRemoved.log({
            transactionGroup: transactionGroup,
            transactionIndex: index
        });
    }

    /**
     * Set signatures for a particular transaction group. Signatures must be included as an array of byte-arrays
     * @param costs Minimum Balance Requirement for associated box storage costs: (2500) + (400 * (40 + signatures.length))
     * @param transactionGroup Transaction Group nonce
     * @param signatures Array of signatures
     */
    arc55_setSignatures(
        costs: PayTxn,
        transactionGroup: uint64,
        signatures: bytes64[]
    ): void {
        this.onlySigner();

        const mbrSigIncrease = this.arc55_mbrSigIncrease(signatures.length * 64);

        verifyTxn(costs, {
            receiver: this.app.address,
            amount: { greaterThanEqualTo: mbrSigIncrease }
        });

        const signatureBox: TransactionSignatures = {
            nonce: transactionGroup,
            address: this.txn.sender
        };

        this._signatures(signatureBox).value = signatures;

        // Emit event
        this.SignatureSet.log({
            transactionGroup: transactionGroup,
            signer: this.txn.sender
        });
    }

    /**
     * Clear signatures for an address. Be aware this only removes it from the current state of the ledger, and indexers will still know and could use your signature
     * @param transactionGroup Transaction Group nonce
     * @param address Address whose signatures to clear
     */
    arc55_clearSignatures(
        transactionGroup: uint64,
        address: Address
    ): void {
        this.onlySigner();

        const signatureBox: TransactionSignatures = {
            nonce: transactionGroup,
            address: address
        };

        const sigLength = this._signatures(signatureBox).size;
        this._signatures(signatureBox).delete;

        // signatureBox costs:
        // + Name: uint64 + address = 8 + 32 = 40
        // + Body: sigLength
        const mbrSigDecrease = (2500) + (400 * (40 + sigLength));

        sendPayment({
            receiver: address,
            amount: mbrSigDecrease
        });

        // Emit event
        this.SignatureSet.log({
            transactionGroup: transactionGroup,
            signer: address
        });
    }
}
