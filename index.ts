import express, { Request, Response } from "express";
import { ReclaimClient } from "@reclaimprotocol/zk-fetch";
import { transformForOnchain, verifyProof } from "@reclaimprotocol/js-sdk";
import { JsonRpcProvider, Wallet, Contract } from "ethers";
import dotenv from "dotenv";
import contractABI from "./contractABI.json";
dotenv.config();

// Initialize the ReclaimClient with the app id and app secret (you can get these from the Reclaim dashboard - https://dev.reclaimprotocol.org/)
const reclaimClient = new ReclaimClient(
  process.env.APP_ID!,
  process.env.APP_SECRET!
);
const app = express();

app.get("/", (_: Request, res: Response) => {
  res.send("gm gm! api is running");
});

app.get("/proof", async (_req: Request, res: Response) => {
  try {
    // URL to fetch the data
    const url =
      "https://www.centralbank.go.ke/wp-admin/admin-ajax.php?action=get_wdtable&table_id=193";

    // Function to get the current date in the format expected by the API
    function getCurrentKenyanDate() {
      // Get current date in UTC
      const now = new Date();

      // Format the date as DD/MM/YYYY
      const day = String(now.getUTCDate()).padStart(2, "0");
      const month = String(now.getUTCMonth() + 1).padStart(2, "0"); // Months are 0-indexed
      const year = now.getUTCFullYear();
      const formattedDate = encodeURIComponent(`${day}/${month}/${year}`);

      return `04%2F12%2F2024~04%2F12%2F2024`; //`${formattedDate}~${formattedDate}`;
    }

    /*
     * Fetch the data from the API and generate a proof for the response.
     * The proof will contain the USD price of Ethereum.
     */
    const proof = await reclaimClient.zkFetch(
      url,
      {
        headers: {
          accept: "application/json, text/javascript, */*; q=0.01",
          "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
        },
        body: `draw=1&columns%5B0%5D%5Bdata%5D=0&columns%5B0%5D%5Bname%5D=date_r&columns%5B0%5D%5Bsearchable%5D=true&columns%5B0%5D%5Borderable%5D=true&columns%5B0%5D%5Bsearch%5D%5Bvalue%5D=${getCurrentKenyanDate()}&columns%5B0%5D%5Bsearch%5D%5Bregex%5D=false&columns%5B1%5D%5Bdata%5D=1&columns%5B1%5D%5Bname%5D=currency&columns%5B1%5D%5Bsearchable%5D=true&columns%5B1%5D%5Borderable%5D=true&columns%5B1%5D%5Bsearch%5D%5Bvalue%5D=US+DOLLAR&columns%5B1%5D%5Bsearch%5D%5Bregex%5D=false&columns%5B2%5D%5Bdata%5D=2&columns%5B2%5D%5Bname%5D=ROUND(jx_views_fx_new_rates.mean%2C4)&columns%5B2%5D%5Bsearchable%5D=true&columns%5B2%5D%5Borderable%5D=true&columns%5B2%5D%5Bsearch%5D%5Bvalue%5D=&columns%5B2%5D%5Bsearch%5D%5Bregex%5D=false&order%5B0%5D%5Bcolumn%5D=0&order%5B0%5D%5Bdir%5D=desc&start=0&length=25&search%5Bvalue%5D=&search%5Bregex%5D=false&sRangeSeparator=~`,
        method: "POST",
      },
      {
        responseMatches: [
          {
            type: "regex",
            value: '"data":\\[\\["([^"]+)","([^"]+)","([^"]+)"\\]\\]',
          },
        ],
      }
    );

    if (!proof) {
      return res.status(400).send("Failed to generate proof");
    }
    // Verify the proof
    const isValid = await verifyProof(proof);
    if (!isValid) {
      return res.status(400).send("Proof is invalid");
    }
    // Transform the proof data to be used on-chain (for the contract)
    const proofData = transformForOnchain(proof);
    if (
      !process.env.PRIVATE_KEY ||
      !process.env.CONTRACT_ADDRESS ||
      !process.env.RPC_URL
    ) {
      throw new Error(
        "PRIVATE_KEY or CONTRACT_ADDRESS or RPC_URL is not defined"
      );
    }
    // Verify the proof on-chain
    const provider = new JsonRpcProvider(process.env.RPC_URL);

    const signer = new Wallet(process.env.PRIVATE_KEY, provider);

    const contract = new Contract(
      process.env.CONTRACT_ADDRESS,
      contractABI,
      signer
    );

    // Call the verifyProof function on the smart contract
    const tx = await contract.verifyProof(proofData);
    await tx.wait();
    console.log(
      "Proof verified on-chain successfully, Here is Transaction Hash:",
      tx.hash
    );

    return res.status(200).json({ transformedProof: proofData, proof });
  } catch (e) {
    console.log(e);
    return res.status(500).send(e);
  }
});

app.get("/proofgen", async (_: Request, res: Response) => {
  try {
    // URL to fetch the data from - in this case, the price of Ethereum in USD from the CoinGecko API
    const url =
      "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd";
    /*
     * Fetch the data from the API and generate a proof for the response.
     * The proof will contain the USD price of Ethereum.
     */
    const proof = await reclaimClient.zkFetch(
      url,
      {
        // public options for the fetch request
        method: "GET",
      },
      {
        // options for the proof generation
        responseMatches: [
          /* 
            * The proof will match the response body with the regex pattern (search for the price of ethereum in the response body 
            the regex will capture the price in the named group 'price').
            * to extract the price of Ethereum in USD. (e.g. {"ethereum":{"usd":3000}}) 
            */
          {
            type: "regex",
            value: '\\{"ethereum":\\{"usd":(?<price>[\\d\\.]+)\\}\\}',
          },
        ],
      }
    );

    if (!proof) {
      return res.status(400).send("Failed to generate proof");
    }
    // Verify the proof
    const isValid = await verifyProof(proof);
    if (!isValid) {
      return res.status(400).send("Proof is invalid");
    }
    // Transform the proof data to be used on-chain (for the contract)
    const proofData = await transformForOnchain(proof);
    return res.status(200).json({ transformedProof: proofData, proof });
  } catch (e) {
    console.log(e);
    return res.status(500).send(e);
  }
});

const PORT = process.env.PORT || 8080;

// Start server
app.listen(PORT, () => {
  console.log(`App is listening on port ${PORT}`);
});
