vconst express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

app.get("/", (req, res) => {
res.sendFile(path.join(__dirname, "index.html"));
});

// STK Push
app.post("/stk-push", async (req, res) => {
try {
const { phone, amount } = req.body;

const response = await fetch(  
  "https://api.paylorke.com/api/v1/merchants/payments/stk-push",  
  {  
    method: "POST",  
    headers: {  
      Authorization: `Bearer ${process.env.PAYLOR_API_KEY}`,  
      "Content-Type": "application/json"  
    },  
    body: JSON.stringify({  
      phone,  
      amount: Number(amount),  
      reference: "NYOTA-" + Date.now(),  
      channelId: process.env.PAYLOR_CHANNEL_ID,  
      description: "NYOTA Funds Payment",  
      callbackUrl: process.env.CALLBACK_URL  
    })  
  }  
);  

const data = await response.json();  

if (!response.ok) {  
  return res.status(response.status).json({  
    success: false,  
    message: data.message || "STK Push failed."  
  });  
}  

res.json({  
  success: true,  
  transactionId: data.transactionId,  
  data  
});

} catch (err) {
console.error("STK Push Error:", err);
res.status(500).json({
success: false,
message: "Server error."
});
}
});

// Transaction status
app.post("/payment-status", async (req, res) => {
try {
const { transactionId } = req.body;

const response = await fetch(  
  `https://api.paylorke.com/api/v1/merchants/payments/transactions/${transactionId}`,  
  {  
    headers: {  
      Authorization: `Bearer ${process.env.PAYLOR_API_KEY}`  
    }  
  }  
);  

const data = await response.json();  

res.json({  
  success: true,  
  data: {  
    status: data.status,  
    reference: data.reference  
  }  
});

} catch (err) {
console.error("Status Check Error:", err);
res.status(500).json({
success: false,
message: "Status check failed."
});
}
});

// Paylor callback
app.post("/callback", (req, res) => {
console.log("Paylor callback:", req.body);
res.sendStatus(200);
});


if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

module.exports = app;

