import { Contract } from '@algorandfoundation/tealscript';

type TransactionGroup = {
    nonce: uint<64>,
    index: uint<8>
};

type TransactionSignatures = {
    nonce: uint<64>,
    address: Address
};

class MsigApp extends Contract {
    // ========== Storage ==========
    // Number of signatures requires
    threshold = GlobalStateKey<uint<64>>({ key: 't' });

    // Incrementing nonce for separating different groups of transactions
    nonce = GlobalStateKey<uint<64>>({ key: 'n' });

    // Transactions
    transactions = BoxMap<TransactionGroup, bytes>({});

    // Signatures
    signatures = BoxMap<TransactionSignatures, bytes[]>({});

    // Signers
    indexToAddress = GlobalStateMap<uint<64>, Address>({ maxKeys: 8, allowPotentialCollisions: true });
    addressCount = GlobalStateMap<Address, uint<64>>({ maxKeys: 8, allowPotentialCollisions: true });


    // ========== Internal ==========
    private is_creator(): boolean {
        return this.txn.sender === globals.creatorAddress;
    }

    private is_signer(): boolean {
        return this.addressCount(this.txn.sender).exists as boolean;
    }


    // ========== External ==========
    /**
     * Deploy a new On-Chain Msig App.
     * @returns Msig App Application ID
     */
    @allow.create("NoOp")
    deploy(): Application {
        return globals.currentApplicationID;
    }

    /**
     * Update the application
     */
    @allow.call("UpdateApplication")
    update(): void {
        assert(this.is_creator());
    }

    /**
     * Destroy the application and return funds to creator address. All transactions must be removed before calling destroy
     */
    @allow.call("DeleteApplication")
    destroy(): void {
        assert(this.is_creator());

        sendPayment({
            amount: 0,
            receiver: globals.creatorAddress,
            closeRemainderTo: globals.creatorAddress,
            fee: 0,
        });
    }

    // ========== ARC55 Interface ==========
    /**
     * Setup On-Chain Msig App. This can only be called whilst no transaction groups have been created.
     * @param threshold Initial multisig threshold, must be greater than 0
     * @param addresses Array of addresses that make up the multisig
     */
    arc55_setup(
        threshold: uint<8>,
        addresses: Address[]
    ): void {
        assert(!this.nonce.value);
        assert(this.is_creator());

        const t: uint<64> = btoi(rawBytes(threshold));
        assert(t);
        this.threshold.value = t;

        this.nonce.value = 0;

        let index = 0;
        let address: Address;
        while (index < addresses.length) {
            address = addresses[index];

            // Store multisig index as key with address as value
            this.indexToAddress(index).value = address;

            // Store address as key and counter as value, this is for
            // ease of authentication, and tracking removal
            this.addressCount(address).value = this.addressCount(address).value + 1;

            index = index + 1;
        }
    }

    /**
     * Generate a new transaction group nonce for holding pending transactions
     * @returns transactionGroup Transaction Group nonce
     */
    arc55_newTransactionGroup(): uint<64> {
        assert(this.is_signer());

        const n = this.nonce.value + 1;
        this.nonce.value = n;

        return n;
    }

    // TODO: Delete old TransactionGroup boxes

    /**
     * Add a transaction to an existing group. Only one transaction should be included per call
     * @param costs Minimum Balance Requirement for associated box storage costs: (2500) + (400 * (9 + transaction.length))
     * @param transactionGroup Transaction Group nonce
     * @param index Transaction position within atomic group to add
     * @param transaction Transaction to add
     */
    arc55_addTransaction(
        costs: PayTxn,
        transactionGroup: uint<64>,
        index: uint<8>,
        transaction: bytes
    ): void {
        assert(this.is_signer());

        // transactionBox costs:
        // + Name: uint64 + uint8 = 8 + 1 = 9
        // + Body: transaction.length
        const mbrTxnIncrease = (2500) + (400 * (9 + transaction.length))

        verifyTxn(costs, {
            receiver: this.app.address,
            amount: mbrTxnIncrease
        });

        assert(transactionGroup);
        assert(transactionGroup <= this.nonce.value);

        const transactionBox: TransactionGroup = {
            nonce: transactionGroup,
            index: index,
        };

        // Store transaction in box
        //const num = this._convertIndexToNumber(index);
        this.transactions(transactionBox).value = transaction;
    }

    /**
     * Remove transaction from the app. The MBR associated with the transaction will be returned to the Msig address.
     * @param transactionGroup Transaction Group nonce
     * @param index Transaction position within atomic group to remove
     */
    arc55_removeTransaction(
        transactionGroup: uint<64>,
        index: uint<8>
    ): void {
        assert(this.is_signer());

        const transactionBox: TransactionGroup = {
            nonce: transactionGroup,
            index: index,
        };

        // Delete the box
        //const num = this._convertIndexToNumber(index);
        this.transactions(transactionBox).delete;
    }

    /**
     * Set signatures for a particular transaction group. Signatures must be included as an array of byte-arrays
     * @param costs Minimum Balance Requirement for associated box storage costs: (2500) + (400 * (40 + signatures.length))
     * @param transactionGroup Transaction Group nonce
     * @param signatures Array of signatures
     */
    arc55_setSignatures(
        costs: PayTxn,
        transactionGroup: uint<64>,
        signatures: bytes[]
    ): void {
        assert(this.is_signer());

        // signatureBox costs:
        // + Name: uint64 + address = 8 + 32 = 40
        // + Body: signatures.length
        const mbrSigIncrease = (2500) + (400 * (40 + signatures.length))

        verifyTxn(costs, {
            receiver: this.app.address,
            amount: mbrSigIncrease,
        });

        const signatureBox: TransactionSignatures = {
            nonce: transactionGroup,
            address: this.txn.sender
        };

        this.signatures(signatureBox).value = signatures;
    }

    /**
     * Clear signatures for an address. Be aware this only removes it from the current state of the ledger, and indexers will still know and could use your signature
     * @param transactionGroup Transaction Group nonce
     * @param address Address whose signatures to clear
     */
    arc55_clearSignatures(
        transactionGroup: uint<64>,
        address: Address
    ): void {
        assert(this.is_signer());

        const signatureBox: TransactionSignatures = {
            nonce: transactionGroup,
            address: address
        };

        const sigLength = this.signatures(signatureBox).size;
        this.signatures(signatureBox).delete;

        // signatureBox costs:
        // + Name: uint64 + address = 8 + 32 = 40
        // + Body: signatures.length
        const mbrSigDecrease = (2500) + (400 * (40 + sigLength))

        sendPayment({
            receiver: address,
            amount: mbrSigDecrease
        });
    }
}
