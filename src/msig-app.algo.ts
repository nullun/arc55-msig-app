import { Contract } from '@algorandfoundation/tealscript';

class MsigApp extends Contract {
    threshold = GlobalStateKey<uint64>({ key: 't' });
    indexToAccount = GlobalStateMap<uint<8>, Account>({ maxKeys: 8 });
    accountCount = GlobalStateMap<Account, uint64>({ maxKeys: 8 });
    transactions = BoxMap<uint<8>, byte[]>({});
    signatures = LocalStateMap<uint64, byte[]>({ maxKeys: 16 });

    private admin_only(): void {
        assert(this.txn.sender === globals.creatorAddress)
    }

    private subsigners_only(): void {
        assert(this.accountCount(this.txn.sender).exists)
    }

    private remove_account_by_index(index: uint<8>): void {
        // Fetch account before deleting
        const acc: Account = this.indexToAccount(index).value;

        // Delete account by index
        this.indexToAccount(index).delete();

        // Decrement account counter, or delete if no longer user
        if (this.accountCount(acc).value >= 1) {
            this.accountCount(acc).value = this.accountCount(acc).value - 1;
        } else {
            this.accountCount(acc).delete();
        }
    }

    private clear_signatures(account: Account, starting_index: uint64): void {
        for (let index = starting_index; index < 16; index = index + 1) {
            this.signatures(account, index).delete();
        }
    }

    /**
     * Deploy a new On-Chain Msig App.
     * @returns Msig App Application ID
     */
    @allow.create("NoOp")
    deploy(): Application {
        this.threshold.value = 1;
        return globals.currentApplicationID;
    }

    /**
     * Update the application
     */
    @allow.call("UpdateApplication")
    update(): void {
        this.admin_only()
    }

    /**
     * Destroy the application and return funds to creator address. All transactions must be removed before calling destroy
     */
    @allow.call("DeleteApplication")
    destroy(): void {
        this.admin_only()

        sendPayment({
            amount: 0,
            receiver: globals.creatorAddress,
            closeRemainderTo: globals.creatorAddress,
            fee: 0,
        });
    }

    /**
     * Add account to multisig
     * @param index Account position within multisig to add
     * @param account Account to add
     */
    addAccount(index: uint<8>, account: Account): void {
        this.admin_only()

        // If index already exists, remove index (and decrement account)
        if (this.indexToAccount(index).exists) {
            this.remove_account_by_index(index);
        }

        // Store multisig index as key with account as value
        this.indexToAccount(index).value = account;

        // Store account as key and counter as value, this is for
        // ease of authentication, and tracking removal
        this.accountCount(account).value = this.accountCount(account).value + 1;
    }

    /**
     * Remove account from multisig
     * @param index Account position within multisig to remove
     */
    removeAccount(index: uint<8>): void {
        this.admin_only()

        // Delete account by multsig index
        this.remove_account_by_index(index);
    }

    /**
     * Update the multisig threshold
     * @param threshold New multisig threshold
     */
    setThreshold(threshold: uint<64>): void {
        this.threshold.value = threshold;
    }

    /**
     * Add transaction to the app. Only one transaction should be included per call
     * @param index Transaction position within atomic group to add
     * @param transaction Transaction to add
     */
    addTransaction(index: uint<8>, transaction: byte[]): void {
        this.admin_only()

        // Store transaction in box
        this.transactions(index).value = transaction;
    }

    /**
     * Remove transaction from the app. Unlike signatures which will remove all previous signatures when a new one is added, you must clear all previous transactions if you want to reuse the same app
     * @param index Transaction position within atomic group to remove
     */
    removeTransaction(index: uint<8>): void {
        this.admin_only()

        // Delete the box
        this.transactions(index).delete();
    }

    /**
     * Set signatures for account. Signatures must be included as an array of byte-arrays
     * @param signatures Array of signatures
     */
    @allow.call("NoOp")
    @allow.call("OptIn")
    setSignatures(signatures: byte[][]): void {
        this.subsigners_only();

        // Process byte[][]

        // Starting at index 0, add each sig to an indexed kv-pair
        let index: uint64;
        for (index = 0; signatures.length > index; index = index + 1) {
            this.signatures(this.txn.sender, index).value = signatures[index];
        }
        // Clear any remaining signatures
        this.clear_signatures(this.txn.sender, index);
    }

    /**
     * Clear signatures for an account. Be aware this only removes it from your local state, and indexers will still know and could use your signature
     */
    @allow.call("NoOp")
    @allow.call("CloseOut")
    clearSignatures(): void {
        this.subsigners_only();

        this.clear_signatures(this.txn.sender, 0);
    }
}
