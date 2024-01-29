import algosdk from 'algosdk';
import { ALGORAND_ZERO_ADDRESS_STRING } from 'algosdk/src/encoding/address';
import * as algokit from "@algorandfoundation/algokit-utils";
import { MsigAppClient } from "./client/MsigApp.client";

const algod = new algosdk.Algodv2('a'.repeat(64), 'http://127.0.0.1', 4001);
const kmd = new algosdk.Kmd('a'.repeat(64), 'http://127.0.0.1', 4002);

const wallets = await kmd.listWallets();
const walletId = wallets.wallets[0].id;
const handle = await kmd.initWalletHandle(walletId, '');
const { addresses } = await kmd.listKeys(handle.wallet_handle_token);
const accounts = [];
for (const address of addresses) {
    accounts.push({
        addr: address,
        sk: (await kmd.exportKey(handle.wallet_handle_token, '', address))['private_key']
    });
}

const appClient = new MsigAppClient({
    resolveBy: 'id',
    id: 0
}, algod);

// Deploy (outside of ARC55)
const deployment = await appClient.create.deploy({
    admin: ALGORAND_ZERO_ADDRESS_STRING
}, {
    sender: accounts[0]
});

// Setup
const setup = await appClient.arc55Setup({
    threshold: 2,
    addresses: [accounts[0].addr, accounts[1].addr, accounts[2].addr]
}, {
    sender: accounts[0]
});
const msig_addr = algosdk.multisigAddress({
    version: 1,
    threshold: 2,
    addrs: [accounts[0].addr, accounts[1].addr, accounts[2].addr]
});
console.log(msig_addr);

// New Transaction Group
const new_transaction_group = await appClient.arc55NewTransactionGroup({}, {
    sender: accounts[0]
});
const transaction_group = new_transaction_group.return as bigint;

// Add Transaction
const zero_payment = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    from: msig_addr,
    to: msig_addr,
    amount: 0,
    suggestedParams: await algod.getTransactionParams().do(),
    note: new Uint8Array(Buffer.from("Testing ARC-55 works"))
});
let txn_cost = await appClient.arc55MbrTxnIncrease({
    transactionSize: zero_payment.toByte().length
}, {
    sender: accounts[0]
});
const add_txn_mbr = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    from: accounts[0].addr,
    to: deployment.appAddress,
    amount: txn_cost.return as bigint,
    suggestedParams: await algod.getTransactionParams().do()
});
const add_txn = await appClient.arc55AddTransaction({
    costs: add_txn_mbr,
    transactionGroup: transaction_group,
    index: 0,
    transaction: zero_payment.toByte()
}, {
    sender: accounts[0],
    sendParams: {
        populateAppCallResources: true,
        suppressLog: true
    }
});

// Replace Transaction with a Large Transaction
// TODO: Use specific value, not 2000.
const large_transaction = algosdk.makeApplicationCallTxnFromObject({
    from: msig_addr,
    appIndex: 0,
    onComplete: algosdk.OnApplicationComplete.DeleteApplicationOC,
    approvalProgram: new Uint8Array(Buffer.from('CiABASJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJIIkgiSCJI', 'base64')),
    clearProgram: new Uint8Array(Buffer.from('CiABASI=', 'base64')),
    extraPages: 3,
    suggestedParams: await algod.getTransactionParams().do()
});
const txn_size = large_transaction.toByte().length;
const add_txn_cost = await appClient.arc55MbrTxnIncrease({
    transactionSize: large_transaction.toByte().length
}, {
    sender: accounts[0]
});

const add_txn_mbr2 = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    from: accounts[0].addr,
    to: deployment.appAddress,
    amount: <bigint>add_txn_cost.return - <bigint>txn_cost.return + 100000n, // We subtrack the previous cost, but keep the min 0.1
    suggestedParams: await algod.getTransactionParams().do()
});
const add_txn2 = await appClient.compose().arc55AddTransaction({
    costs: add_txn_mbr2,
    transactionGroup: transaction_group,
    index: 0,
    transaction: large_transaction.toByte().slice(0, 2000)
}, {
    sender: accounts[0],
    sendParams: {
        populateAppCallResources: true,
        suppressLog: true
    }
});
for (let n = 1; n < txn_size/2000; n++) {
    await add_txn2.arc55AddTransactionContinued({
        transaction: large_transaction.toByte().slice(2000 * n, 2000 * (n+1))
    }, {
        sender: accounts[0],
        sendParams: {
            populateAppCallResources: true,
            suppressLog: true
        }
    });
}
await add_txn2.execute();

// Set Signatures
const sig_data = new Uint8Array(large_transaction.rawSignTxn(accounts[0].sk));
txn_cost = await appClient.arc55MbrSigIncrease({
    signaturesSize: sig_data.length
}, {
    sender: accounts[0]
});
const set_sig_mbr = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    from: accounts[0].addr,
    to: deployment.appAddress,
    amount: txn_cost.return as bigint,
    suggestedParams: await algod.getTransactionParams().do()
});
const set_sig = await appClient.arc55SetSignatures({
    costs: set_sig_mbr,
    transactionGroup: transaction_group,
    signatures: [sig_data]
}, {
    sender: accounts[0],
    sendParams: {
        populateAppCallResources: true,
        suppressLog: false
    }
});

// Clear Signatures
const clear_sig = await appClient.arc55ClearSignatures({
    transactionGroup: transaction_group,
    address: accounts[0].addr
}, {
    sender: accounts[0],
    sendParams: {
        fee: algokit.microAlgos(2000)
    }
});

// Remove Transaction
const remove_txn = await appClient.arc55RemoveTransaction({
    transactionGroup: transaction_group,
    index: 0
}, {
    sender: accounts[0],
    sendParams: {
        fee: algokit.microAlgos(2000)
    }
});

// Destroy
const destroy_txn = await appClient.delete.destroy({}, {
    sender: accounts[0],
    sendParams: {
        fee: algokit.microAlgos(2000)
    }
});
