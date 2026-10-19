const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 10000;

// Middleware
app.use(cors());
app.use(express.json({ limit: "100kb" }));
app.use(express.static(__dirname));

// Home page
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// Commitment page
app.get("/commitment.html", (req, res) => {
  res.sendFile(
    path.join(__dirname, "commitment.html"),
    (err) => {
      if (err && !res.headersSent) {
        console.error(
          "Could not find commitment.html:",
          err.message
        );

        res.status(404).send(
          "commitment.html was not found on the server."
        );
      }
    }
  );
});

// Health check
app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "NYOTA Funds server is running"
  });
});

// Helper: safely parse provider response
async function readResponse(response) {
  const text = await response.text();

  try {
    return JSON.parse(text);
  } catch {
    return {
      message: text || "Invalid response from payment provider"
    };
  }
}

// STK Push payment request
app.post("/stk-push", async (req, res) => {
  try {
    const { phone, amount } = req.body || {};

    // Validate phone number and amount
    if (
      typeof phone !== "string" ||
      !/^254\d{9}$/.test(phone) ||
      amount === undefined ||
      amount === null ||
      amount === "" ||
      !Number.isFinite(Number(amount)) ||
      Number(amount) <= 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Enter a valid Kenyan phone number in 254XXXXXXXXX format and a positive amount."
      });
    }

    // Environment variables configured in Render
    const apiKey = process.env.PAYLOR_API_KEY;
    const channelId = process.env.PAYLOR_CHANNEL_ID;
    const callbackUrl = process.env.CALLBACK_URL;

    if (!apiKey || !channelId || !callbackUrl) {
      console.error("Missing payment environment variables:", {
        PAYLOR_API_KEY: Boolean(apiKey),
        PAYLOR_CHANNEL_ID: Boolean(channelId),
        CALLBACK_URL: Boolean(callbackUrl)
      });

      return res.status(500).json({
        success: false,
        message: "Payment service is not configured correctly."
      });
    }

    // Submit STK Push request to Paylor
    const response = await fetch(
      "https://api.paylorke.com/api/v1/merchants/payments/stk-push",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          phone,
          amount: Number(amount),
          reference: "NYOTA-" + Date.now(),
          channelId,
          description: "NYOTA Funds Payment",
          callbackUrl
        })
      }
    );

    const data = await readResponse(response);

    if (!response.ok) {
      console.error("Paylor STK Push failed:", {
        status: response.status,
        message: data.message || data.error || "Provider error"
      });

      return res.status(
        response.status >= 400 && response.status < 500
          ? response.status
          : 502
      ).json({
        success: false,
        message:
          data.message ||
          data.error ||
          "Paylor could not process the payment request."
      });
    }

    return res.status(200).json({
      success: true,
      message: "Payment request submitted.",
      transactionId: data.transactionId || null,
      data
    });
  } catch (error) {
    console.error("STK Push server error:", error.message);

    return res.status(500).json({
      success: false,
      message:
        "Unable to contact the payment service. Please try again."
    });
  }
});

// Check transaction status
app.post("/payment-status", async (req, res) => {
  try {
    const { transactionId } = req.body || {};

    if (
      typeof transactionId !== "string" ||
      !transactionId.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "A valid transaction ID is required."
      });
    }

    const apiKey = process.env.PAYLOR_API_KEY;

    if (!apiKey) {
      console.error("PAYLOR_API_KEY is missing.");

      return res.status(500).json({
        success: false,
        message: "Payment service is not configured."
      });
    }

    const response = await fetch(
      "https://api.paylorke.com/api/v1/merchants/payments/transactions/" +
        encodeURIComponent(transactionId),
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`
        }
      }
    );

    const data = await readResponse(response);

    if (!response.ok) {
      console.error("Payment status lookup failed:", {
        status: response.status,
        message: data.message || data.error || "Provider error"
      });

      return res.status(
        response.status >= 400 && response.status < 500
          ? response.status
          : 502
      ).json({
        success: false,
        message:
          data.message ||
          data.error ||
          "Unable to retrieve payment status."
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        status: data.status ?? data.data?.status ?? "unknown",
        reference: data.reference ?? data.data?.reference ?? null
      }
    });
  } catch (error) {
    console.error("Payment status error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to check payment status."
    });
  }
});

// Callback URL browser test
app.get("/callback", (req, res) => {
  res.status(200).send(
    "NYOTA Funds callback endpoint is online."
  );
});

// Paylor payment callback
app.post("/callback", (req, res) => {
  try {
    console.log("Paylor callback received.");

    // Implement Paylor's documented callback authentication
    // and payment verification before trusting callback data.
    // Do not mark a payment successful based only on
    // receiving a callback.

    res.sendStatus(200);
  } catch (error) {
    console.error("Callback handler error:", error.message);
    res.sendStatus(500);
  }
});

// Handle unsupported methods on the STK Push endpoint
app.all("/stk-push", (req, res) => {
  res.status(405).json({
    success: false,
    message: "Method not allowed."
  });
});

// Start server
if (require.main === module) {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(
      `NYOTA Funds server listening on port ${PORT}`
    );
  });
}

module.exports = app;

