# ARC55: Msig App

TEALScript Edition

Use:
```sh
npm install @algorandfoundation/tealscript
npx tealscript src/msig-app.algo.ts output
```

# Post Use Housekeeping

An important part of reusing an ARC55 Msig App is the housekeeping after use. This is a manual process, but can be carried out exclusively by the admin to make sure everyone is ready for a subsequent transaction to sign.

After a transaction has been successfully submitted the transaction data and the signatures can be deleted. Only the admin is capable of removing the transactions, however each user may clear their own signatures. Failure to remove the signatures before updating the transaction could result in invalid signatures being used, believing that an account of the multisig has already provided their signature. For this reason the admin may also clear the signatures of each subsigner, and it's recommended for the admin to do so.

A typical lifecycle would look like this:

 * Admin deploys Msig App, with a threshold of 2.
 * Admin adds 2 accounts to form a new multisig.
 * Admin adds a new transaction to sign.
 * Account 1 provides their signatures.
 * Account 2 provides their signatures.
 * Anyone can now submit the transaction to the network.
 * Admin clears the signatures of each account.
 * Admin removes the transaction since it's now committed to the network.
 * Admin is ready to add a new transaction.