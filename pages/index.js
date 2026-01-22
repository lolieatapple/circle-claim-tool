import Head from "next/head";
import Image from "next/image";
import { Inter } from "next/font/google";
import styles from "@/styles/Home.module.css";
import Wallet from "../components/Wallet";
import useWallet from "../hooks/useWallet";
import { useState } from "react";
import { ethers } from 'ethers';
import { checkATA, createATA, solanaClaim } from "@/components/solana";
const TokenMessagerAbi = require('../assets/TokenMessager.json');
const MessageTransmitterAbi = require('../assets/MessageTransmitter.json');
const FeeAbi = require('../assets/Fee.json');
const FeeV2Abi = require('../assets/FeeV2.json');

const inter = Inter({ subsets: ["latin"] });

const claimSC = {
  '1': '0xeC0D8Cfd081ccce2D6Ed4E3dd8f248D3cAa3d24B',
  '10': '0x592dE30Bebff484B5a43A6E8E3ec1a814902E0b6',
  '137': '0x30b8d9e757595B5cbAEcdFD81e9Eeccf4B31e53D',
  '43114': '0x0D4d2595B1d83AB6110b4291816D62d1417C5A8B',
  '42161': '0xD4B5f10D61916Bd6E0860144a91Ac658dE8a1437',
  '8453': '0x012297F3d1Cb0D685B195A70231730F4c8c86F86',
}

const v2ClaimSC = {
  // mainnet
  '1': '0x4bF9D67a254bD7C8E4a164e8363FFEDeC4128444', // ethereum
  '43114': '0x1342FE3Ff6Fe8B701d8067AE83A37d10bEc7aB1b', // avalanche
  '10': '0xf5db314d1Bb8e6166a2b54B057dCa934ac3b5d43', // op mainnet
  '42161': '0x65f17bBFb1c2B8eF9165e2F936122b6d88106CC5', // arbitrum
  '8453': '0x76C51350705756030c70cCb82EF23345C2a4610E', // base
  '137': '0xC702c95612cd70B0440571DD7FA9c7B3057C152B', // polygon
  '130': '0x22C835B306916ec6cb3568e7ffD61bF821Ed593d', // unichain
  '59144': '0xD6965a9b739240dB7ACD36E3AFb2dfe1dAE7c694', // linea
  '146': '0x508927b6247179D72142B60Fc69f5E4d58cbEb64', // sonic
  '480': '0x79d745178BC271A1f29F8fbE9251dfC512db842C', // worldchain
  '1329': '0xDd8830d9454365a3b81d0EC6F4272AE5337795bb', // sei
  '50': '0x77E3695C26FF538B4dB9593B20620b73D00c7059', // xdc network

  // testnet
  '11155111': '0xf0750293079b29573A752Bc7222aAaEbf3208308', // eth
  '43113': '0x7dc37a6ACfe3eD545f5500811C0E12D71b21bcA7', // avax
  '11155420': '0xCbB55130E7DA1fF04c36D61f75CC615A7854eeb8', // op
  '421614': '0x25034ecf7050D8ee536ADf51f41C7aAEAB480F27', // arb
  '84532': '0x4915736A3623c2BaC3a4D545FD12019ad46Ad6d5', // base
  '80001': '0x5F09De765c1B35B6454321adB3E36E15418bbc0C', // polygon
  '4801': '0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275', // worldchain
  '1301': '0x4915736A3623c2BaC3a4D545FD12019ad46Ad6d5', // unichain
  '59141': '0x4915736A3623c2BaC3a4D545FD12019ad46Ad6d5', // linea
  '14601': '0x4915736A3623c2BaC3a4D545FD12019ad46Ad6d5', // sonic
  '51': '0x15618F79663c27613CF895709BD4f1C2D28e49A2', //xinfin
  '1328': '0x25034ecf7050D8ee536ADf51f41C7aAEAB480F27', //sei
}

// Mapping from chainId to Circle domain
const chainIdToDomain = {
  // Mainnet
  '1': 0,        // Ethereum
  '43114': 1,    // Avalanche
  '10': 2,       // OP Mainnet
  '42161': 3,    // Arbitrum
  '8453': 6,     // Base
  '137': 7,      // Polygon PoS
  '130': 10,     // Unichain
  '59144': 11,   // Linea
  '146': 13,     // Sonic
  '480': 14,     // World Chain
  '1329': 16,    // Sei
  '56': 17,      // BNB Smart Chain
  '50': 18,      // XDC
  
  // Testnet
  '11155111': 0, // Ethereum Sepolia
  '43113': 1,    // Avalanche Fuji
  '11155420': 2, // OP Sepolia
  '421614': 3,   // Arbitrum Sepolia
  '84532': 6,    // Base Sepolia
  '80001': 7,    // Polygon Amoy
  '4801': 14,    // World Chain Sepolia
  '1301': 10,    // Unichain Sepolia
  '59141': 11,   // Linea Sepolia
  '14601': 13,   // Sonic Testnet
  '51': 18,      // XDC Apothem
  '1328': 16,    // Sei Testnet
}

export default function Home() {
  const { wallet, setWallet } = useWallet();
  const [loading, setLoading] = useState(false);
  const [found, setFound] = useState(false);
  const [txhash, setTxhash] = useState('');
  const [amount, setAmount] = useState('');
  const [message, setMessage] = useState('');
  const [attestation, setAttestation] = useState('');
  const [isSolana, setIsSolana] = useState(false);
  const [solanaAddress, setSolanaAddress] = useState('');
  const [ataAddress, setAtaAddress] = useState('');
  const [isV2, setIsV2] = useState(false);

  const search = async () => {
    if (!wallet.connected) {
      window.alert("Please connect wallet first");
      return;
    }
    if (!txhash) {
      window.alert("Please enter tx hash");
      return;
    }

    setLoading(true);
    setIsV2(false); // Reset v2 flag for new search

    try {
      const web3 = wallet.web3;
      let ret = await web3.eth.getTransactionReceipt(txhash);
      console.log('ret', ret);
      if (!ret) {
        window.alert('Transaction not found, please switch wallet network to correct source chain.');
        throw new Error('Transaction not found, please switch wallet network to correct source chain.');
      }
      const iface = new ethers.Interface(TokenMessagerAbi);
      let _messageHash;
      let _attestation;
      ret.logs.forEach((log)=>{
        const decoded = iface.parseLog(log);
        console.log('decoded', decoded);
        if (decoded && decoded.name === 'Transfer') {
          setAmount((decoded.args.value.toString() / 1e6).toString());
        }

        if (decoded && decoded.name === 'MessageSent') {
          _messageHash = ethers.keccak256(decoded.args.message);
          console.log('_messageHash', _messageHash);
          console.log('message', decoded.args.message);
          setMessage(decoded.args.message);
        }

        if (decoded && decoded.name === 'DepositForBurn') {
          let domain = Number(decoded.args.destinationDomain);
          console.log('domain', domain);
          if (domain === 5) {
            setIsSolana(true);
          }
        }
      });

      if (!_messageHash) {
        window.alert('Cross chain message not found, please switch wallet network to source chain.');
        throw new Error('Cross chain message not found, please switch wallet network to source chain.');
      }

      for (let i=0; i<100; i++) {
        // wait 5 seconds 
        await new Promise((resolve) => setTimeout(resolve, 5000));
        try {
          console.log('fetching attestation...');
          let att = await fetch('https://iris-api.circle.com/attestations/' + _messageHash);
          console.log('att', att);
          att = await att.json();
          console.log('att', att);
          
          // If v1 API returns "Message hash not found", try v2 API with txHash
          if (att.error === 'Message hash not found') {
            console.log('Message hash not found, trying v2 API with txHash...');
            // Get source domain from chainId
            let sourceDomain = chainIdToDomain[wallet.networkId.toString()];
            if (sourceDomain === undefined) {
              console.error('Unknown chain ID for domain mapping:', wallet.networkId);
              sourceDomain = 0; // Default to Ethereum
            }
            console.log('Using source domain:', sourceDomain, 'for chainId:', wallet.networkId);
            let attV2 = await fetch('https://iris-api.circle.com/v2/messages/' + sourceDomain + '?transactionHash=' + txhash);
            console.log('attV2', attV2);
            attV2 = await attV2.json();
            console.log('attV2', attV2);
            
            // v2 API response structure: {messages: [{attestation, status, message, ...}]}
            if (attV2.messages && attV2.messages.length > 0) {
              att = attV2.messages[0];
              setIsV2(true); // Mark as v2 response
              // Use v2 message (modified message from API)
              setMessage(att.message);
            }
          }
          
          if (att.status !== 'complete') {
            continue;
          } else {
            setAttestation(att.attestation);
            break;
          }
        } catch (error) {
          console.error(error);
        }
      }

      setFound(true);
    } catch (error) {
      console.error(error);
    }
    
    // wait 2 seconds
    setLoading(false);
  }

  const claim = async () => {
    if (!wallet.connected) {
      window.alert("Please connect wallet first");
      return;
    }
    if (!txhash) {
      window.alert("Please enter tx hash");
      return;
    }

    if (!message || !attestation) {
      window.alert('Message attestation not found');
      return;
    }

    setLoading(true);


    try {
      const web3 = wallet.web3;
      console.log('chainId', wallet.networkId);
      
      // Use different ABI, contract address and method signature based on v1 or v2
      if (isV2) {
        console.log('Using V2 ABI, contract address and receiveMessage method');
        const contractAddress = v2ClaimSC[wallet.networkId.toString()];
        if (!contractAddress) {
          window.alert('Please switch correct wallet network for V2');
          return;
        }
        let sc = new web3.eth.Contract(FeeV2Abi, contractAddress);
        // V2 receiveMessage only takes (message, attestation)
        let tx = await sc.methods.receiveMessage(message, attestation).send({from: wallet.address});
        console.log('tx', tx);
      } else {
        console.log('Using V1 ABI, contract address and receiveMessage method');
        const contractAddress = claimSC[wallet.networkId.toString()];
        if (!contractAddress) {
          window.alert('Please switch correct wallet network for V1');
          return;
        }
        let sc = new web3.eth.Contract(FeeAbi, contractAddress);
        // V1 receiveMessage takes (message, attestation, mintRecipient, feeRecipient)
        let tx = await sc.methods.receiveMessage(message, attestation, '0x' + wallet.address.slice(2).toLowerCase().padStart(64, '0'), wallet.address).send({from: wallet.address});
        console.log('tx', tx);
      }

      setFound(false);
    } catch (error) {
      console.error(error);
    }
    
    setLoading(false);
  }

  return (
    <>
      <Head>
        <title>Circle USDC Claim Tool</title>
        <meta
          name="description"
          content="The Circle USDC Claim Tool is a software application designed to help users claim their cross-chain USDC (USD Coin) tokens."
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <main className={styles.main}>
        <Wallet wallet={wallet} setWallet={setWallet} />

        <div className={styles.description}>
          {wallet.connected && (
            <p
              variant="outlined"
              sx={{ textTransform: "none" }}
              onClick={async () => {
                wallet.resetApp().then(() => {
                  wallet.connect();
                });
              }}
            >
              {wallet.address.slice(0, 6) + "..." + wallet.address.slice(-4)}
            </p>
          )}
          {!wallet.connected && (
            <p
              variant="outlined"
              onClick={async () => {
                wallet.resetApp().then(() => {
                  wallet.connect();
                });
              }}
            >
              Connect Wallet
            </p>
          )}
          <div>
            <a
              href="https://wanchain.org"
              target="_blank"
              rel="noopener noreferrer"
            >
              By{" "}
              <Image
                src="/wanchain.png"
                alt="Wanchain Logo"
                className={styles.vercelLogo}
                width={100}
                height={24}
                priority
              />
            </a>
          </div>
        </div>

        <div className={styles.center}>
          <div style={{width: '800px'}}>
          <h2>Manually process missed cross-chain txs with TX Hash</h2>
          <br/>
          <p>
          1. Please switch your wallet network to the initiating chain of the USDC cross-chain transfer, enter the txHash, and click on the Search button.
          </p>
          <br />
          <p>
          2. For Evm chains, Once you have located the transaction record, please switch your wallet network to the target chain of the USDC cross-chain transfer, and click on the Claim button.
          </p>
          <br />
          <div style={{ display: "flex", alignItems: "center", margin: '40px 0 0 0' }}>
            <input
              type="text"
              style={{
                padding: "10px",
                borderRadius: "5px 0 0 5px",
                border: "1px solid #ccc",
                width: "100%",
                marginRight: "10px",
              }}
              placeholder="Enter TX Hash..."
              value={txhash}
              onChange={e=>{
                setTxhash(e.target.value);
              }}
            />
            {
              !isSolana && <button
                type="submit"
                style={{
                  padding: "10px",
                  backgroundColor: "#007bff",
                  borderRadius: "0 5px 5px 0",
                  border: "none",
                  color: "#fff",
                }}
                onClick={async () => {
                  if (!found) {
                    await search();
                  } else {
                    await claim();
                  }
                }}
              >
                {
                  loading ? 'Waiting...' : (found ? 'Claim' :'Search')
                }
              </button>
            }
            
          </div>
          <br />
          {
            found && (
              <div>
                <p>Found 1 tx with amount: {amount} USDC</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '10px' }}>
                  <span>Message: {message.slice(0, 6)}...{message.slice(-6)}</span>
                  <button
                    style={{
                      padding: '5px 10px',
                      backgroundColor: '#28a745',
                      border: 'none',
                      borderRadius: '3px',
                      color: '#fff',
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                    onClick={() => {
                      navigator.clipboard.writeText(message);
                      alert('Message copied to clipboard!');
                    }}
                  >
                    Copy Message
                  </button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '10px' }}>
                  <span>Attestation: {attestation.slice(0, 6)}...{attestation.slice(-6)}</span>
                  <button
                    style={{
                      padding: '5px 10px',
                      backgroundColor: '#28a745',
                      border: 'none',
                      borderRadius: '3px',
                      color: '#fff',
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                    onClick={() => {
                      navigator.clipboard.writeText(attestation);
                      alert('Attestation copied to clipboard!');
                    }}
                  >
                    Copy Attestation
                  </button>
                </div>
              </div>
            )
          }
          {
            isSolana && !attestation && <div>Fetching CCTP attestation...</div>
          }
          <br />
          {
            isSolana && attestation && <div>
              Please fill your destination Solana recipient address and click Check button:
              <br />
              <input style={{
                padding: "10px",
                borderRadius: "5px",
                border: "1px solid #ccc",
                width: "100%",
                margin: '10px 0'
              
              }} type="text" placeholder="Solana Receipent Wallet Address" value={solanaAddress} onChange={e=>setSolanaAddress(e.target.value)} />
              {
                !ataAddress && <button style={{
                  padding: "10px",
                  backgroundColor: "#007bff",
                  borderRadius: "5px",
                  border: "none",
                  color: "#fff",
                }} onClick={async ()=>{
                  setLoading(true);
                  try {
                    let ata = await checkATA(solanaAddress);
                    console.log('ret', ata);
                    if (!ata.status) {
                      let ok = window.confirm('USDC Associated Token Address is not found, do you want create it now?');
                      console.log('ok', ok);
                      if (ok) {
                        let ret = await createATA(solanaAddress, ata.ata);
                        setAtaAddress(ata.ata);
                      }
                    } else {
                      setAtaAddress(ata.ata);
                    }
                  } catch (error) {
                    console.error(error);
                  }
                  
                  setLoading(false);
                }}>
                  {loading ? 'Waiting...' : 'Check USDC Associated Token Address (ATA)'}
                </button>
              }
              {
                ataAddress && <button style={{
                  padding: "10px",
                  backgroundColor: "#007bff",
                  borderRadius: "5px",
                  border: "none",
                  color: "#fff",
                }} onClick={async ()=>{
                  setLoading(true);
                  try {
                    let txHash = await solanaClaim(attestation, message, ataAddress, solanaAddress);
                    console.log('txHash', txHash);
                    window.alert('Claim success, tx hash: ' + txHash);
                  } catch (error) {
                    console.error(error);
                  }
                  
                  setLoading(false);
                }}>
                  {loading ? 'Waiting...' : 'Claim'}
                </button>
              }
              
            
            </div>
          }
          </div>
          
        </div>

        <div className={styles.grid}>
          <a
            href="https://www.wanchain.org"
            className={styles.card}
            target="_blank"
            rel="noopener noreferrer"
          >
            <h2 className={inter.className}>
              Wanchain <span>-&gt;</span>
            </h2>
            <p className={inter.className}>
              Find in-depth information about Wanchain.
            </p>
          </a>

          <a
            href="https://wanscan.org"
            className={styles.card}
            target="_blank"
            rel="noopener noreferrer"
          >
            <h2 className={inter.className}>
              Wanscan <span>-&gt;</span>
            </h2>
            <p className={inter.className}>Blockchain explorer of Wanchain.</p>
          </a>

          <a
            href="https://bridge.wanchain.org"
            className={styles.card}
            target="_blank"
            rel="noopener noreferrer"
          >
            <h2 className={inter.className}>
              WanBridge <span>-&gt;</span>
            </h2>
            <p className={inter.className}>
              Official cross chain Bridge of Wanchain.
            </p>
          </a>

          <a
            href="https://explorewanchain.org"
            className={styles.card}
            target="_blank"
            rel="noopener noreferrer"
          >
            <h2 className={inter.className}>
              Guide <span>-&gt;</span>
            </h2>
            <p className={inter.className}>Show you how to use Wanchain.</p>
          </a>
        </div>
      </main>
    </>
  );
}
