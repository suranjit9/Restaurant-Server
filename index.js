const express = require('express')
const app = express()
var jwt = require('jsonwebtoken');
const cors = require('cors');
// const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const stripe = require("stripe")('sk_test_51Ow6nvRtkUz25OCJRU02vDUeCNmj0L1I57tGmzQ1lF3cnVjs9Akn09iPX6FTYtdPIyGMyh6ijb4347XNdzWY4iRo00Wv86EHkD');
require('dotenv').config();
console.log()
const port = process.env.PORT || 5000;

// MedalWar.........
app.use(cors());
app.use(express.json());

// const verifyToken = (req, res, next) => {
//   console.log('hhhhhhhhhh', req.headers.authoriztion);
//   if (!req.headers.authoriztion) {
//     return res.status(401).send({ message: 'Forbidden Access' })
//   }
//   // Bearer eyJhbGciOiJ ----- token get clint site and divide by " " spase and get [1] 2nd array ;

//   const token = req.headers.authoriztion.split(' ')[1];
//   jwt.verify(token, process.env.ACC_TOKEN, (err, decoded) => {
//     if (err) {
//       return res.status(401).send({ message: 'Forbidden Access' })
//     }
//     req.decoded = decoded;
//     next()
//   })

// };
// const verifyAdmin = async (req, res, next)=>{
//   const email = req.decoded.email;
//   const query = {email:email};
//   const user = await usercollection.findOne(query);
//   console.log(user)
//   const isAdmin = user?.role === 'Admin';
//   if (!isAdmin) {
//     return res.status(403).send({message:'Forbidden Access'})
//   }
//   next();
// }


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
    const newMenucollection = client.db("Restaurant-Server").collection("newMenu");
    const cartscollection = client.db("Restaurant-Server").collection("carts");
    const paymentscollection = client.db("Restaurant-Server").collection("payment");
    const verifyToken = (req, res, next) => {
      // console.log('hhhhhhhhhh', req.headers.authoriztion);
      if (!req.headers.authoriztion) {
        return res.status(401).send({ message: 'Forbidden Access' })
      }
      // Bearer eyJhbGciOiJ ----- token get clint site and divide by " " spase and get [1] 2nd array ;

      const token = req.headers.authoriztion.split(' ')[1];
      jwt.verify(token, process.env.ACC_TOKEN, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: 'Forbidden Access' })
        }
        req.decoded = decoded;
        next()
      })

    };
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await usercollection.findOne(query);

      const isAdmin = user?.role === 'Admin';
      if (!isAdmin) {
        return res.status(403).send({ message: 'Forbidden Access' })
      }
      next();
    }
    // Payment------------------Start--
    app.post("/create-payment-intent", async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);
      // const amount = parseInt(parseFloat(price) * 100);
      // console.log(amount)
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ['card']
      });
      res.send({
        clientSecret: paymentIntent.client_secret
      })
    });
    app.post('/cardpayment', async (req, res) => {
      const payment = req.body;
      const paymentResult = await paymentscollection.insertOne(payment);
      // delete eatch item from the cart
      const query = {
        _id: {
          $in: payment.CartIds.map(id => new ObjectId(id))
        }
      };
      const deleteResult = await cartscollection.deleteMany(query);
      res.send({ paymentResult, deleteResult })
    });
    app.get('/cardpayment/recive/:email', verifyToken, async (req, res) => {
      const query = { email: req.params.email };
      if (req.params.email !== req.decoded.email) {
        return res.status(403).send({ message: 'Forbidden Access' })
      }
      const result = await paymentscollection.find(query).toArray();
      res.send(result);
    })


    // Payment------------------END----
    // Stats or Analyics------------Start
    app.get('/admin-Analyics', verifyToken, verifyAdmin, async (req, res) => {
      const users = await usercollection.estimatedDocumentCount();
      const menus = await menucollection.estimatedDocumentCount();
      const oders = await paymentscollection.estimatedDocumentCount();
      const result = await paymentscollection.aggregate([
        {
          $group: {
            _id: null,
            totalRevenue: {
              $sum: '$price'
            }
          }
        }
      ]).toArray();
      const revenue = result.length > 0 ? result[0].totalRevenue : 0;
      res.send({
        users,
        menus,
        oders,
        revenue
      })
    });
    // using Aggregate pip line for stats----
    app.get('/order-stats', verifyToken, verifyAdmin, async (req, res) => {
      
      const result = await paymentscollection.aggregate([

        {
          $unwind: '$menuItemIds'
        },
        {
          $lookup: {
              from: "menu",
              let: { menuItemId: { $toObjectId: "$menuItemIds" } },
              pipeline: [
                  {
                      $match: {
                          $expr: { $eq: ["$_id", "$$menuItemId"] }
                      }
                  }
              ],
              as: 'matchedMenuItems'
          }
      },
        {
          $unwind: '$matchedMenuItems'
        },
        {
          $group: {
            _id: '$matchedMenuItems.category',
            quantity: {
              $sum: 1
            },
            revenue: { $sum: '$matchedMenuItems.price' }
          }
        },
        {
          $project: {
            _id: 0,
            category: '$_id',
            quantity: '$quantity',
            revenue: '$revenue'
          }
        }
      ]).toArray();
     
      res.send(result)
    });
  
    
    
    // Stats or Analyics------------END

    // Jwt Relate Api-----------
    app.post('/jwt', async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACC_TOKEN, {
        expiresIn: '5h'
      });
      res.send({ token });
    })
    // User data post------
    app.post("/users", async (req, res) => {
      const userData = req.body;
      const query = { email: userData.email }
      const find = await usercollection.findOne(query);
      if (find) {
        return;
      }
      const result = await usercollection.insertOne(userData);
      res.send(result);
    })
    // get Allusers-----------
    app.get('/users', verifyToken, verifyAdmin, async (req, res) => {

      const result = await usercollection.find().toArray();
      res.send(result);
    })
    // Delete Users----------------
    app.delete('/users/:id', verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await usercollection.deleteOne(query);
      res.send(result);
    });
    // Created an admin-------
    app.patch('/users/admin/:id', verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: 'Admin'
        },
      };
      const result = await usercollection.updateOne(filter, updateDoc);
      res.send(result);
    });
    // Find admin / user ----
    app.get('/users/admin/:email', verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: 'Unauthorzed Access' })
      }
      const query = { email: email };
      const user = await usercollection.findOne(query);
      let admin = false;
      if (user) {
        admin = user?.role === 'Admin'
      }
      res.send({ admin });
    })
    // Post menu item ------------
    app.post('/menu', async (req, res) => {
      const menulist = req.body;
      const result = await menucollection.insertOne(menulist);
      res.send(result)
    })
    // Get all Menu ------------
    app.get('/menu', async (req, res) => {
      const result = await menucollection.find().toArray();
      res.send(result)
    })
    // Menu Deleta ------------
    app.delete('/menu/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await menucollection.deleteOne(query);
      res.send(result);
    })
    // Update menu item ------------------------start---
    app.get(`/menu/:id`, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await menucollection.findOne(query);
      res.send(result);
    })
    app.patch(`/menu/:id`, async (req, res) => {
      const id = req.params.id;
      const find = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          name: item.name,
          category: item.category,
          price: item.price,
          recipe: item.recipe,
          image: item.image
        }
      };
      const result = await menucollection.updateOne(filter, updatedDoc)
      res.send(result);
    })
    // Update menu item ------------------------END---
    // Add to Add to carts Data
    app.post('/carts', async (req, res) => {
      const ciartItem = req.body;
      const result = await cartscollection.insertOne(ciartItem);
      res.send(result)
    })
    // get add cart from clint site........
    app.get('/carts', async (req, res) => {
      // recived email from clint site
      const email = req.query.email;
      // find email fild to email...
      const query = { email: email };
      const result = await cartscollection.find(query).toArray();
      res.send(result);
    });
    // deleat for user cart 
    app.delete("/usercart/:id", async (req, res) => {
      const cardId = req.params.id;
      const query = { _id: new ObjectId(cardId) };
      const result = await cartscollection.deleteOne(query);
      res.send(result)
    })

    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    // // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // console.log("Pinged your deployment. You successfully connected to MongoDB!");
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