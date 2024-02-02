import { Contract } from '@algorandfoundation/tealscript';
import { ARC55 } from './arcs/arc55.algo';

class MsigApp extends Contract.extend(ARC55) {
    /**
     * Deploy a new On-Chain Msig App.
     * @param admin Address of person responsible for calling `arc55_setup`
     * @returns Msig App Application ID
     */
    @allow.create("NoOp")
    deploy(admin: Address): Application {
        // If no-one is set, default to the sender/creator
        if (admin != globals.zeroAddress) {
            this.arc55_setAdmin(admin);
        } else {
            this.arc55_setAdmin(this.txn.sender);
        }

        return globals.currentApplicationID;
    }

    /**
     * Update the application
     */
    @allow.call("UpdateApplication")
    update(): void {
        this.onlyAdmin();
    }

    /**
     * Destroy the application and return funds to creator address. All transactions must be removed before calling destroy
     */
    @allow.call("DeleteApplication")
    destroy(): void {
        this.onlyAdmin();

        sendPayment({
            amount: 0,
            receiver: globals.creatorAddress,
            closeRemainderTo: globals.creatorAddress,
            fee: 0,
        });
    }
}
