import algosdk from 'algosdk';
import { MsigAppClient } from "./client/MsigApp.client";

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

const algod = new algosdk.Algodv2('a'.repeat(64), 'http://127.0.0.1', 4001);

const appClient = new MsigAppClient({
    resolveBy: 'id',
    id: 0
}, algod);

// Deploy (outside of ARC55)
const deployment = await appClient.create.deploy({}, {
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

const sp = await algod.getTransactionParams().do();
sp.flatFee = true;
sp.fee = 1000;
const init_mbr = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    from: accounts[0].addr,
    to: deployment.appAddress,
    amount: 100000,
    suggestedParams: sp
});
await algod.sendRawTransaction(init_mbr.signTxn(accounts[0].sk)).do();

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
    suggestedParams: sp,
    note: new Uint8Array(Buffer.from("Testing ARC-55 works"))
});
const txn_cost = await appClient.arc55MbrTxnIncrease({
    transaction: zero_payment.toByte()
}, {
    sender: accounts[0]
});
const add_txn_mbr = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    from: accounts[0].addr,
    to: deployment.appAddress,
    amount: txn_cost.return as bigint,
    suggestedParams: sp
});
const add_txn = await appClient.arc55AddTransaction({
    costs: add_txn_mbr,
    transactionGroup: transaction_group,
    index: 0,
    transaction: zero_payment.toByte()
}, {
    sender: accounts[0]
});