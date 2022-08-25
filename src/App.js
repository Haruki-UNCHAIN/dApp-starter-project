import React, { useEffect, useState, useCallback } from "react";
import "./App.css";
import { ethers } from "ethers";
import abi from "./utils/WavePortal.json";

const contractABI = abi.abi;
const contractAddress = "0x6CFfBfbcaE4e6c8Aec0ffC267c88A780C3cbf57F";

const Chains = {
  1: "Ethereum Mainnet",
  3: "Ropsten",
  4: "Rinkeby",
  5: "Goerli",
  42: "Kovan",
  56: "BSC Mainnet",
  97: "BSC Testnet",
  137: "Matic Mainnet",
  80001: "Matic Testnet Mumbai",
  43113: "Avalanche FUJI C-Chain",
  43114: "Avalanche Mainnet C-Chain",
};

const App = () => {
  const [currentAccount, setCurrentAccount] = useState("");
  const [messageValue, setMessageValue] = useState("");
  const [allWaves, setAllWaves] = useState([]);
  const [contractBalance, setContractBalance] = useState("-");
  const [walletBalance, setWalletBalance] = useState("-");
  const [chainName, setChainName] = useState("Unknown");

  const getAllWaves = async () => {
    const { ethereum } = window;

    try {
      if (ethereum) {
        const provider = new ethers.providers.Web3Provider(ethereum);
        const signer = provider.getSigner();
        const wavePortalContract = new ethers.Contract(
          contractAddress,
          contractABI,
          signer
        );
        /* コントラクトからgetAllWavesメソッドを呼び出す */
        const waves = await wavePortalContract.getAllWaves();
        const wavesCleaned = waves.map((wave) => {
          return {
            address: wave.waver,
            timestamp: new Date(wave.timestamp * 1000),
            message: wave.message,
          };
        });
        /* React Stateにデータを格納する */
        setAllWaves(wavesCleaned);
      } else {
        console.log("Ethereum object doesn't exist!");
      }
    } catch (error) {
      console.log(error);
    }
  };

  /* window.ethereumにアクセスできることを確認する関数を実装 */
  const checkIfWalletIsConnected = useCallback(async () => {
    try {
      const { ethereum } = window;
      if (!ethereum) {
        console.log("Make sure you have MetaMask!");
        return;
      } else {
        console.log("We have the ethereum object", ethereum);
      }
      /* ユーザーのウォレットへのアクセスが許可されているかどうかを確認 */
      const accounts = await ethereum.request({ method: "eth_accounts" });
      if (accounts.length !== 0) {
        const account = accounts[0];
        console.log("Found an authorized account:", account);
        setCurrentAccount(account);
        getAllWaves();
      } else {
        console.log("No authorized account found");
      }
    } catch (error) {
      console.log(error);
    }
  }, []);

  useEffect(() => {
    checkIfWalletIsConnected();
  }, [checkIfWalletIsConnected]);

  /**
   * `emit`されたイベントをフロントエンドに反映させる
   */
  useEffect(() => {
    let wavePortalContract;

    const onNewWave = (from, timestamp, message) => {
      console.log("NewWave", from, timestamp, message);
      setAllWaves((prevState) => [
        ...prevState,
        {
          address: from,
          timestamp: new Date(timestamp * 1000),
          message: message,
        },
      ]);
    };

    const _setChainName = async () => {
      const chainId = await window.ethereum.request({ method: "eth_chainId" });
      const _chainName = Chains[parseInt(chainId)] ?? "Unknown";
      setChainName(_chainName);
    };

    /* NewWaveイベントがコントラクトから発信されたときに、情報を受け取ります */
    if (window.ethereum) {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();

      window.ethereum.on("chainChanged", () => _setChainName());
      _setChainName();

      wavePortalContract = new ethers.Contract(
        contractAddress,
        contractABI,
        signer
      );

      provider
        .getBalance(wavePortalContract.address)
        .then((balance) =>
          setContractBalance(ethers.utils.formatEther(balance))
        );

      wavePortalContract.on("NewWave", onNewWave);
    }

    /*メモリリークを防ぐために、NewWaveのイベントを解除します*/
    return () => {
      if (wavePortalContract) {
        wavePortalContract.off("NewWave", onNewWave);
      }
    };
  }, []);

  useEffect(() => {
    if (currentAccount) {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      provider
        .getBalance(currentAccount)
        .then((balance) =>
          setWalletBalance(
            parseFloat(ethers.utils.formatEther(balance)).toFixed(5)
          )
        );
    }
  }, [currentAccount, chainName]);

  /* connectWalletメソッドを実装 */
  const connectWallet = async () => {
    try {
      const { ethereum } = window;
      if (!ethereum) {
        alert("Get MetaMask!");
        return;
      }
      const accounts = await ethereum.request({
        method: "eth_requestAccounts",
      });
      console.log("Connected: ", accounts[0]);
      setCurrentAccount(accounts[0]);
    } catch (error) {
      console.log(error);
    }
  };

  /* waveの回数をカウントする関数を実装 */
  const wave = async () => {
    try {
      const { ethereum } = window;
      if (ethereum) {
        const provider = new ethers.providers.Web3Provider(ethereum);
        const signer = provider.getSigner();

        const wavePortalContract = new ethers.Contract(
          contractAddress,
          contractABI,
          signer
        );
        let count = await wavePortalContract.getTotalWaves();
        console.log("Retrieved total wave count...", count.toNumber());

        let contractBalance_prev = await provider.getBalance(
          wavePortalContract.address
        );
        console.log("Contract balance:", contractBalance);
        /* コントラクトに👋（wave）を書き込む */
        const waveTxn = await wavePortalContract.wave(messageValue, {
          gasLimit: 300000,
        });
        console.log("Mining...", waveTxn.hash);
        await waveTxn.wait();
        console.log("Mined -- ", waveTxn.hash);
        count = await wavePortalContract.getTotalWaves();
        console.log("Retrieved total wave count...", count.toNumber());

        let contractBalance_post = await provider.getBalance(
          wavePortalContract.address
        );
        setContractBalance(ethers.utils.formatEther(contractBalance_post));

        provider
          .getBalance(currentAccount)
          .then((balance) =>
            setWalletBalance(
              parseFloat(ethers.utils.formatEther(balance)).toFixed(5)
            )
          );
        /* コントラクトの残高が減っていることを確認 */
        if (contractBalance_post.lt(contractBalance_prev)) {
          /* 減っていたら下記を出力 */
          console.log("User won ETH!");
        } else {
          console.log("User didn't win ETH.");
        }
        console.log(
          "Contract balance after wave:",
          ethers.utils.formatEther(contractBalance_post)
        );
      } else {
        console.log("Ethereum object doesn't exist!");
      }
    } catch (error) {
      console.log(error);
      // alert(error.message)
    }
  };

  return (
    <div className="mainContainer">
      <div className="dataContainer">
        <div className="header">
          <span role="img" aria-label="hand-wave">
            👋
          </span>
          &nbsp;WELCOME!
        </div>
        <div className="bio">
          イーサリアムウォレットを接続して、メッセージを作成したら、
          <span role="img" aria-label="hand-wave">
            👋
          </span>
          を送ってください
          <span role="img" aria-label="shine">
            ✨
          </span>
        </div>
        <div>Chain Name: {chainName}</div>
        <div>Wallet Balance: {walletBalance}</div>
        <div>Contract Balance: {contractBalance} ETH</div>
        <br />

        {/* ウォレットコネクトのボタンを実装 */}
        {currentAccount ? (
          <button className="waveButton">Wallet Connected</button>
        ) : (
          <button className="waveButton" onClick={connectWallet}>
            Connect Wallet
          </button>
        )}

        {currentAccount && (
          <>
            <button className="waveButton" onClick={wave}>
              Wave at Me
            </button>
            <br />
            <textarea
              name="messageArea"
              placeholder="メッセージはこちら"
              type="text"
              id="message"
              value={messageValue}
              onChange={(e) => setMessageValue(e.target.value)}
            />
            {allWaves
              .slice(0)
              .reverse()
              .map((wave, index) => {
                return (
                  <div
                    key={index}
                    style={{
                      backgroundColor: "#F8F8FF",
                      marginTop: "16px",
                      padding: "8px",
                    }}
                  >
                    <div>Address: {wave.address}</div>
                    <div>Time: {wave.timestamp.toString()}</div>
                    <div>Message: {wave.message}</div>
                  </div>
                );
              })}
          </>
        )}
      </div>
    </div>
  );
};
export default App;
