import { Contract } from '@algorandfoundation/tealscript';
import { ARC55 } from './arcs/arc55.algo';

class MsigApp extends Contract.extend(ARC55) {
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
        this.onlyCreator();
    }

    /**
     * Destroy the application and return funds to creator address. All transactions must be removed before calling destroy
     */
    @allow.call("DeleteApplication")
    destroy(): void {
        this.onlyCreator();

        sendPayment({
            amount: 0,
            receiver: globals.creatorAddress,
            closeRemainderTo: globals.creatorAddress,
            fee: 0,
        });
    }
}
