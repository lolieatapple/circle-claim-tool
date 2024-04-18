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

const inter = Inter({ subsets: ["latin"] });

const claimSC = {
  '1': '0xeC0D8Cfd081ccce2D6Ed4E3dd8f248D3cAa3d24B',
  '10': '0x592dE30Bebff484B5a43A6E8E3ec1a814902E0b6',
  '137': '0x30b8d9e757595B5cbAEcdFD81e9Eeccf4B31e53D',
  '43114': '0x0D4d2595B1d83AB6110b4291816D62d1417C5A8B',
  '42161': '0xD4B5f10D61916Bd6E0860144a91Ac658dE8a1437',
  '8453': '0x012297F3d1Cb0D685B195A70231730F4c8c86F86',
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
      if (!claimSC[wallet.networkId.toString()]) {
        window.alert('Pleaese switch correct wallet network');
        return;
      }

      let sc = new web3.eth.Contract(FeeAbi, claimSC[wallet.networkId.toString()]);
      let tx = await sc.methods.receiveMessage(message, attestation, '0x' + wallet.address.slice(2).toLowerCase().padStart(64, '0'), wallet.address).send({from: wallet.address});
      console.log('tx', tx);

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
            found && (<p>Found 1 tx with amount: {amount} USDC, message: {message.slice(0, 4)}...{message.slice(-4)}, attestation: {attestation.slice(0, 4)}...{attestation.slice(-4)}</p>)
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
