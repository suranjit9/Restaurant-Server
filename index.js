const express = require('express')
const app = express()
var jwt = require('jsonwebtoken');
const cors = require('cors');
require('dotenv').config()
const port = process.env.PORT || 5000;

// MedalWar.........
app.use(cors());
app.use(express.json());

const verifyToken = (req, res, next) =>{
  console.log('hhhhhhhhhh',req.headers.authoriztion);
  if (!req.headers.authoriztion) {
    return res.status(401).send({message:'Forbidden Access'})
  }
  // Bearer eyJhbGciOiJ ----- token get clint site and divide by " " spase and get [1] 2nd array ;

  const token = req.headers.authoriztion.split(' ')[1];
  jwt.verify(token, process.env.ACC_TOKEN, (err, decoded)=>{
    if (err) {
      return res.status(401).send({message:'Forbidden Access'})
    }
    req.decoded=decoded;
    next()
  })

}


const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_ID}:${process.env.DB_PASS}@cluster0.gzl03ny.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

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
    const usercollection = client.db("Restaurant-Server").collection("users");
    const menucollection = client.db("Restaurant-Server").collection("menu");
    const cartscollection = client.db("Restaurant-Server").collection("carts");
    // Jwt Relate Api-----------
    app.post('/jwt', async(req, res)=>{
      const user = req.body;
      const token = jwt.sign(user, process.env.ACC_TOKEN,{
        expiresIn: '1h'
      });
      res.send({token});
    })
    // User data post------
    app.post("/users", async(req, res)=>{
      const userData = req.body;
      const query = {email: userData.email}
      const find = await usercollection.findOne(query);
      if (find) {
        return console.log("bhduihfiuz");
      }
      const result = await usercollection.insertOne(userData);
      res.send(result);
    })
    // get Allusers-----------
    app.get('/users',verifyToken, async(req, res)=>{
     
      const result = await usercollection.find().toArray();
      res.send(result);
    })
    // Delete Users----------------
    app.delete('/users/:id', async(req, res)=>{
      const id = req.params.id;
      const query = {_id: new ObjectId(id)};
      const result = await usercollection.deleteOne(query);
      res.send(result);
    });
    // Created an admin-------
    app.patch('/users/admin/:id', async(req, res)=>{
      const id = req.params.id;
      const filter = {_id: new ObjectId(id)};
      const updateDoc = {
        $set: {
          role: 'Admin'
        },
      };
      const result = await usercollection.updateOne(filter, updateDoc);
      res.send(result);
    })
    // Get all Menu ------------
    app.get('/menu', async (req, res) => {
      const result = await menucollection.find().toArray();
      res.send(result)
    })
    // Add to Add to carts Data
    app.post('/carts', async (req, res) => {
      const ciartItem = req.body;
      const result = await cartscollection.insertOne(ciartItem);
      res.send(result)
    })
    // get add cart from clint site........
    app.get('/carts', async(req, res)=>{
      // recived email from clint site
      const email = req.query.email;
      // find email fild to email...
      const query = {email:email};
      const result = await cartscollection.find(query).toArray();
      res.send(result);
    });
    // deleat for user cart 
    app.delete("/usercart/:id", async(req, res)=>{
      const cardId = req.params.id;
      const query = {_id: new ObjectId(cardId)};
      const result = await cartscollection.deleteOne(query);
      res.send(result)
    })

    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
  res.send('Hello World!')
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})