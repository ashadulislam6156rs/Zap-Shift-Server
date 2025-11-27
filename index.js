const express = require('express');
const cors = require('cors');
const app = express();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

const port = process.env.PORT ||  3000;

//midelware
app.use(express.json());
app.use(cors());
require('dotenv').config();

//root Api
app.get("/", (req, res) => {
    res.send("ZapShift Server Is Running.....")
})

/// DataBase
const uri = `${process.env.DB_URI}`;

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