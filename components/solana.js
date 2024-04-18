const anchor = require("@coral-xyz/anchor");
const {  sendAndConfirmTransaction, Transaction,  ComputeBudgetProgram, } = require("@solana/web3.js");
const spl = require('@solana/spl-token');
const { PublicKey, TransactionMessage, VersionedTransaction } = require('@solana/web3.js');

const {bs58} = require('@coral-xyz/anchor/dist/cjs/utils/bytes');

const messageTransmitter_idl = require('./abi/idl_message_transmitter.json');
const tokenMessagerMinter_idl = require('./abi/idl_token_messenger_minter.json');
const cctp_fee_program_idl = require('./abi/circle_cctp_proxy_contract.json');

const rpcUrl = 'https://solana-mainnet.g.alchemy.com/v2/CU30_Q3Jrxz54VG1xXDLlwG4slawLsVv';
const usdcAddress = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";


export async function checkATA(walletAddr) {
  let owner = new anchor.web3.PublicKey(walletAddr);
  let tokenAddress = new anchor.web3.PublicKey(usdcAddress);

  let connection = new anchor.web3.Connection(rpcUrl);
  let ataAddress = spl.getAssociatedTokenAddressSync(tokenAddress, owner);
  let onOnchainAtaInfo = await connection.getAccountInfo(ataAddress);
  console.log('onOnchainAtaInfo: ', onOnchainAtaInfo);
  return onOnchainAtaInfo ? {status: true, ata: ataAddress.toBase58()} : {status: false, ata: ataAddress.toBase58()} ;
}

export async function createATA(walletAddr, ataAddr) {
  let owner = new anchor.web3.PublicKey(walletAddr);
  let ataPk = new anchor.web3.PublicKey(ataAddr);
  let usdc_addr_publicKey = new anchor.web3.PublicKey(usdcAddress);
  let create_tx = new Transaction();
  create_tx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 }));
  create_tx.add(
    spl.createAssociatedTokenAccountInstruction(
      owner, 
      ataPk,
      owner, 
      usdc_addr_publicKey
    ));
  let ret = await sendTransaction(create_tx.instructions, owner);
  return ret;
}

async function sendTransaction(instructions, payer) {
  let provider = window.phantom.solana;
  if (!provider) {
    window.alert('Can not find Phantom wallet!!');
    return;
  }
  let connection = new anchor.web3.Connection(rpcUrl);

  let payerKey = provider.publicKey;
  console.log('payerKey: ', payerKey, payer);
  let recentBlockHash = await connection.getLatestBlockhash();
  let messageV0 = new TransactionMessage({payerKey: payer, recentBlockhash: recentBlockHash.blockhash, instructions}).compileToV0Message();
  let tx = new VersionedTransaction(messageV0);
  console.log('tx', tx);
  let signedTx = await provider.signTransaction(tx);
  let signature = await connection.sendRawTransaction(signedTx.serialize(),  { skipPreflight: true });
  console.log('send tx', signature);
  return signature;
}

const hexToSolanaAddress = (hexs) => {
  let addrBuf = hexToBuff(hexs);
  return  bs58.encode(addrBuf);
}

const hexToBuff= (hex)=> {
  let newHex = hexTrip0x(hex);
  return Buffer.from(newHex, 'hex');
}
function hexTrip0x(hexs) {
  if (0 == hexs.indexOf('0x')) {
      return hexs.slice(2);
  }
  return hexs;
}

const decodeNonceFromMessage = (message) => {
  const messageBytes = Buffer.from(message.replace("0x", ""), "hex");
  const nonceIndex = 12;
  const nonceBytesLength = 8;
  const eventNonceBytes = messageBytes.subarray(nonceIndex, nonceIndex +
      nonceBytesLength);
  const eventNonceHex = `0x${eventNonceBytes.toString("hex")}`;
  return BigInt(eventNonceHex);
};

const findProgramAddress = (
  label,
  programId,
  extraSeeds
) => {
  const seeds = [Buffer.from(anchor.utils.bytes.utf8.encode(label))];
  if (extraSeeds) {
      for (const extraSeed of extraSeeds) {
          if (typeof extraSeed === "string") {
              seeds.push(Buffer.from(anchor.utils.bytes.utf8.encode(extraSeed)));
          } else if (Array.isArray(extraSeed)) {
              seeds.push(Buffer.from(extraSeed));
          } else if (Buffer.isBuffer(extraSeed)) {
              seeds.push(extraSeed);
          } else {
              seeds.push(extraSeed.toBuffer());
          }
      }
  }
  const res = anchor.web3.PublicKey.findProgramAddressSync(seeds, programId);
  return { publicKey: res[0], bump: res[1] };
};

class CCTPMessageFormat {
  constructor(messageBytes) {

      this.version = messageBytes.subarray(0, 4);
      this.sourceDomain = messageBytes.subarray(4, 4+4);
      this.destinationDomain = messageBytes.subarray(8, 8+4);
      this.nonce = messageBytes.subarray(12, 12+8);
      this.sender = messageBytes.subarray(20, 20+32);
      this.recipient = messageBytes.subarray(52, 52+32);
      this.destinationCaller = messageBytes.subarray(84, 84+32);
      this.message_body_version = messageBytes.subarray(116, 116+4);
      this.message_body_burnToken = messageBytes.subarray(116 + 4, 116+4+32);
      this.message_body_mintRecipient = messageBytes.subarray(116 + 36, 116+36+32);
      this.message_body_amount = messageBytes.subarray(116 + 68, 116+68+32);
      this.message_body_messageSender = messageBytes.subarray(116 + 100, 116+100+32);
  }
  getVersion() {
      return parseInt('0x'+this.version.toString("hex"))
  }
  getSourceDomain() {
      return parseInt('0x'+this.sourceDomain.toString("hex"));
  }
  getDestinationDomain() {
      return parseInt('0x'+this.destinationDomain.toString("hex"))
  }
  getNonce() {
      return BigInt('0x'+this.nonce.toString("hex"));
  }
  getSender() {
      return this.sender;
  }
  getRecipient() {
      return this.recipient
  }
  getDestinationCaller() {
      return this.destinationCaller;
  }
  getBurnToken(){
      return this.message_body_burnToken;
  }
  getMintRecipient(){
      return this.message_body_mintRecipient;
  }
  getAmount() {
      return BigInt('0x'+this.message_body_amount.toString("hex"));
  }
  getMessageSender() {
      return this.message_body_messageSender;
  }

}


export async function solanaClaim(attestation, message, ataAddr, walletAddr) {
  console.log('solanaClaim', attestation, message, ataAddr, walletAddr);
  let main_chainConfig = {
    feeProgramId:"D8tMd16M6BraHdNxUTMJPq4RPUYVsQ6DswVvDqTCGoup",
    messageTransmiterID:"CCTPmbSD7gX1bxKPAmg77w8oFzNFpaQiQUWD43TKaecd",
    tokenMessengerID:"CCTPiPYPc6AsJuwueEnWgSgucamXDZwBd53dQ11YiKX3",
  }

  let owner = new anchor.web3.PublicKey(walletAddr);

  console.log('solana 1');

  const messageTransmitter_programID = new anchor.web3.PublicKey(main_chainConfig.messageTransmiterID);
  const tokenMessageMinter_programID = new anchor.web3.PublicKey(main_chainConfig.tokenMessengerID);

  const cctp_fee_programID = new anchor.web3.PublicKey(main_chainConfig.feeProgramId);
  console.log('solana 2');
  let connection = new anchor.web3.Connection(rpcUrl);
  
  let provider;
  if (window.phantom) {
    provider = window.phantom.solana;
    if (provider && provider.isPhantom) {

      provider.connection = connection;
    }
  } else {
    window.alert('Can not find Phantom wallet!!');
    return;
  }

  console.log('solana 3');

  const messageTransmitterProgram = new anchor.Program(messageTransmitter_idl, messageTransmitter_programID, provider);
  const tokenMessengerMinterProgram = new anchor.Program(tokenMessagerMinter_idl, tokenMessageMinter_programID, provider);
  const cctp_fee_program = new anchor.Program(cctp_fee_program_idl,cctp_fee_programID, provider);
  console.log('solana 4');

  let messageHex = message;

  let messageBuf = hexToBuff(message);
  let formMsg = new CCTPMessageFormat(messageBuf);

  let remoteTokenBuf = formMsg.getBurnToken();

  let remoteDomain = formMsg.getSourceDomain();
  console.log('remoteDomain: ', remoteDomain);
  console.log('solana 5');

  let bs58_minRecipient = ataAddr;
  let userTokenAccount = new anchor.web3.PublicKey(bs58_minRecipient);

  let usdcPk = new anchor.web3.PublicKey(usdcAddress);

  const nonce = decodeNonceFromMessage(messageHex);
  console.log('solana 6');


  const tokenMessenger = findProgramAddress("token_messenger",
    tokenMessengerMinterProgram.programId);

  const remoteTokenMessengerKey = findProgramAddress("remote_token_messenger",
    tokenMessengerMinterProgram.programId, [
        remoteDomain.toString(),
    ]);
  console.log('solana 7');

  const tokenMinter = findProgramAddress("token_minter",
    tokenMessengerMinterProgram.programId);
  console.log('solana 8');

  const localToken = findProgramAddress("local_token",
    tokenMessengerMinterProgram.programId, [usdcPk]);

  const remoteTokenKey = new anchor.web3.PublicKey(remoteTokenBuf);
  const tokenPair = findProgramAddress("token_pair",
    tokenMessengerMinterProgram.programId, [
        remoteDomain.toString(),
        remoteTokenKey,
    ]);

  const messageTransmitterAccount = findProgramAddress("message_transmitter",
    messageTransmitterProgram.programId);


  const custodyTokenAccount = findProgramAddress("custody",
    tokenMessengerMinterProgram.programId, [
      usdcPk,
    ]);

  const authorityPda = findProgramAddress(
    "message_transmitter_authority",
    messageTransmitterProgram.programId,
    [tokenMessengerMinterProgram.programId]
  ).publicKey;
  console.log('solana 9');

  const maxNoncesPerAccount = 6400;
  const firstNonce = ((nonce - BigInt(1)) / BigInt(maxNoncesPerAccount)) *
    BigInt(maxNoncesPerAccount) + BigInt(1);

  const usedNonces = findProgramAddress("used_nonces",
    messageTransmitterProgram.programId, [
        remoteDomain.toString(),
        firstNonce.toString(),
    ]).publicKey;


  console.log('solana 10');

  const messageTransmitterEventAuthority = findProgramAddress("__event_authority",
    messageTransmitterProgram.programId);


  // Build the accountMetas list. These are passed as remainingAccounts for the TokenMessengerMinter CPI
  const accountMetas = [];

  accountMetas.push({
    isSigner: false,
    isWritable: false,
    pubkey: tokenMessenger.publicKey,
  });
  accountMetas.push({
    isSigner: false,
    isWritable: false,
    pubkey: remoteTokenMessengerKey.publicKey,
  });
  accountMetas.push({
    isSigner: false,
    isWritable: true,
    pubkey: tokenMinter.publicKey,
  });
  accountMetas.push({
    isSigner: false,
    isWritable: true,
    pubkey: localToken.publicKey,
  });
  accountMetas.push({
    isSigner: false,
    isWritable: false,
    pubkey: tokenPair.publicKey,
  });
  accountMetas.push({
    isSigner: false,
    isWritable: true,
    pubkey: userTokenAccount,
  });
  accountMetas.push({
    isSigner: false,
    isWritable: true,
    pubkey: custodyTokenAccount.publicKey,
  });
  accountMetas.push({
    isSigner: false,
    isWritable: false,
    pubkey: spl.TOKEN_PROGRAM_ID,
  });

  const tokenMessengerEventAuthority = findProgramAddress("__event_authority",
    tokenMessengerMinterProgram.programId);
  console.log('solana 11');

  accountMetas.push({
    isSigner: false,
    isWritable: false,
    pubkey: tokenMessengerEventAuthority.publicKey,
  });
  accountMetas.push({
    isSigner: false,
    isWritable: false,
    pubkey: tokenMessengerMinterProgram.programId,
  });


  // Call receiveMessage to mint the USDC
  // userKeypair must have SOL for gas fees
  let tx = new Transaction();
  // needs to be the first instruction
  // experiment with this number to find one where the transaction succeeds.
  tx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 }));// IX-01
  const receiveMessageTx = await cctp_fee_program.methods
    .receiveMessage(
        {
            message: Buffer.from(messageHex.replace("0x", ""), "hex"),
            attestation: Buffer.from(attestation.replace("0x", ""), "hex"),
        },
        userTokenAccount,
        usdcPk
    )
    // Add all needed accounts
    .accounts({
        circleCctpProgram:messageTransmitterProgram.programId,
        payer: owner,
        caller: owner,
        authorityPda,
        messageTransmitter: messageTransmitterAccount.publicKey,
        usedNonces,
        receiver: tokenMessengerMinterProgram.programId,
        systemProgram: anchor.web3.SystemProgram.programId,
        eventAuthority: messageTransmitterEventAuthority.publicKey,
        program: messageTransmitterProgram.programId,
    })
    // Add remainingAccounts needed for TokenMessengerMinter CPI
    .remainingAccounts(accountMetas)
    .transaction();
  
  console.log('solana 12');
  
  tx.add(receiveMessageTx);
  let txHash = await sendTransaction(tx.instructions, owner);
  console.log('txHash', txHash);
  return txHash;
}

