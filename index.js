const express = require('express');
const cors = require('cors');
const app = express();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

//midelware
app.use(express.json());
app.use(cors());
require('dotenv').config();

const port = process.env.PORT || 3000;


const varyfyFBToken = (req, res, next) => {

  console.log(req.headers.authorization);
  const token = req.headers.authorization;
  if (!token) {
    return res.status(401).send({message: "Unauthorized access!"})
  }
  

  next();
  
}

//payment gatway
const stripe = require('stripe')(process.env.PAYMENT_GATEWAY_SECRET);

// app.use(express.static('public'));

//root Api
app.get("/", (req, res) => {
    res.send("ZapShift Server Is Running.....")
})

/// DataBase
const uri = `${process.env.DB_URI}`;

/// generate  tracking id
const crypto = require('crypto');

function generateTrackingId({ prefix = 'TRK', length = 8 } = {}) {
  // length = number of random hex characters (will be uppercased)
  const bytes = Math.ceil(length / 2);
  const rnd = crypto.randomBytes(bytes).toString('hex').slice(0, length).toUpperCase();
  const ts = Date.now().toString(36).toUpperCase(); // compact timestamp
  return `${prefix}-${ts}-${rnd}`;
}

const trackingId = generateTrackingId();


// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
      await client.connect();
      
      const db = client.db("zapShift_DB");
    const parcelsCollections = db.collection("parcels");
    const paymentCollections = db.collection("payments");

      //parcels get method
      app.get("/parcels", async (req, res) => {
          const result = await parcelsCollections.find().toArray();
          res.send(result);
      })

      //parcels post method
      app.post("/parcels", async (req, res) => {
          const newParcel = req.body;
          const result = await parcelsCollections.insertOne(newParcel);
          res.send(result);
      })

      //myParcels get method
      app.get("/myParcels", async (req, res) => {
          const email = req.query.email;
          const query = {};
          const options = {set:{createdAt: -1}}
          if (email) {
              query.senderEmail = email;
          }
          const result = await parcelsCollections.find(query, options).toArray();
          res.send(result);
      })

      //myParcels Dlete method
      app.delete("/myParcels/:id", async (req, res) => {
          const id = req.params.id;
          const query = {_id: new ObjectId(id)};
          const result = await parcelsCollections.deleteOne(query);
          res.send(result);
      })

      //myParcels Payment Get method
      app.get("/payment/:id", async (req, res) => {
          const id = req.params.id;
          const query = {_id: new ObjectId(id)};
          const result = await parcelsCollections.findOne(query);
          res.send(result);
      })
    
    /// Payment related apis

    app.post('/create-checkout-session', async (req, res) => {
      
      const paymentInfo = req.body;
      const amount = paymentInfo.totalCost * 100;
       const session = await stripe.checkout.sessions.create({
    line_items: [
      {
        price_data: {
          currency: "USD",
          product_data: {
            name: paymentInfo.parcelName,

          },
          unit_amount: amount,

        },
        quantity: 1,
      },
         ],
         customer_email: paymentInfo.senderEmail,
         metadata: {
           parcelId: paymentInfo.parcelId,
           parcelName: paymentInfo.parcelName,
          },
    mode: 'payment',
         success_url: `${process.env.SITE_DOMAIN}/dashboard/payment/success?session_id={CHECKOUT_SESSION_ID}`,
         cancel_url: `${process.env.SITE_DOMAIN}/dashboard/payment/cancel`,
    
       });
      
      res.send({url: session.url})
      
     
      
      
    })

    app.patch("/payment/success", async (req, res) => {
      const sessionId = req.query.session_id;
      const session = await stripe.checkout.sessions.retrieve(sessionId);

      const query = { transactionId: session.payment_intent };
      const paymentExist = await paymentCollections.findOne(query);
      if (paymentExist) {
        return res.send({ message: "Already Exist" });
      }

      if (session.payment_status === "paid") {
        id = session.metadata.parcelId;
        const query = {
          _id: new ObjectId(id)
        }
        const update = {
          $set: {
            paymentStatus: "Paid",
            trackingId: trackingId,
          }
        }
        const result = await parcelsCollections.updateOne(query, update)
        

        const payment = {
          totalCost: session.amount_total / 100,
          currency: session.currency,
          customerEmail: session.customer_email,
          parcelId: session.metadata.parcelId,
          parcelName: session.metadata.parcelName,
          transactionId: session.payment_intent,
          paymentStatus: session.payment_status,
          paidAt: new Date(),
        }

        if (session.payment_status === "paid") {
          const resultPayment = await paymentCollections.insertOne(payment);

          res.send({success: true,transactionId: session.payment_intent, trackingId: trackingId, modifyParcel:result, paymentInfo: resultPayment});
          
        }
      }
      

      res.send({success: false})
   })

    
    /// Payments apis
    
    app.get("/payments", varyfyFBToken, async (req, res) => {
      const email = req.query.email;
      const query = {};
      
      if (email) {
        query.customerEmail = email;
      }
      const result = await paymentCollections.find(query).toArray();
      res.send(result);
    })


    // Send a ping to confirm a successful connection
      await client.db("admin").command({ ping: 1 });
      
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    
  }
}
run().catch(console.dir);



app.listen(port, () => {
    console.log(`ZapShift Server Is Running Port: ${port}`);
    
})