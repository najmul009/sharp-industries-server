const express = require('express')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express();
const jwt = require('jsonwebtoken');
const port = process.env.PORT || 5000
const cors = require('cors')
app.use(cors())
app.use(express.json())
require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.nirim.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });


function verifyJWT(req,res,next){
    const accessToken = req.headers.authorization;
    if(!accessToken){
        return res.status(401).send({message:'UnAuthorized access'})
    }
    const token = accessToken.split(' ')[1];
    jwt.verify(token,process.env.ACCESS_TOKEN,function(err,decoded){
        if(err){
            return res.status(403).send({message:'Forbidden access'})
        }
        req.decoded = decoded;
        next()
    })
}

async function run() {
    try {
        await client.connect()
        const toolsCollection = client.db("sharp-db").collection("tools")
        const orderCollection = client.db("sharp-db").collection("orders")
        const userCollection = client.db("sharp-db").collection("users")
        const paymentCollection = client.db("sharp-db").collection("payments")
        const reviewCollection = client.db("sharp-db").collection("reviews")



        //verifyadmin function
        const verifyAdmin =async( req,res,next)=>{
            const requester = req.decoded.email;
            const isAdmin = await userCollection.findOne({email:requester});
            if(isAdmin.role === 'admin'){
                next()
            }else{
                return res.status(401).send({message:'Forbidden access'})
            }
        }



        //creating payment intent and secret key
        app.post('/create-payment-intent', async (req, res) => {
            const paymentData = req.body;
            const price =paymentData.totalAmount;
            const amount = price*100;        
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: "usd",
                payment_method_types:['card']
            });         
            res.send({
              clientSecret: paymentIntent.client_secret,
            });
          });
        

        // main route 
        app.get('/tools', async (req, res) => {
            const query = {}
            const items = await toolsCollection.find(query).toArray()
            res.send(items)
        })


        //get all reviews
        app.get('/reviews', async (req, res) => {
            const query = {}
            const items = await reviewCollection.find(query).toArray()
            res.send(items)
        })       

        //add new user and create JWT
        app.put('/user/:email', async (req, res) => {
            const email = req.params.email;
            const user = req.body;
            const filter = { email: email };
            const options = { upsert: true };
            const updateDoc = {
                $set: user,
            };
            const result = await userCollection.updateOne(filter, updateDoc, options);
            const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN, { expiresIn: '24h' });
            res.send({ result, token })
        });


        //admin check
        app.get('/admin/:email',async(req,res)=>{
            const email = req.params.email;
            const filter = { email: email };
            const isAdmin = await userCollection.find(filter).toArray();
            if(isAdmin[0].role==='admin'){
                res.send(isAdmin)
            }
            else{
                res.status(403).send({message:'Forbidden access'})
            }
        });


        // route for single product
        app.get('/tools/:id', async (req, res) => {
            const id = req.params.id;
            const query = {_id: ObjectId(id)}
            const result = await toolsCollection.findOne(query);
            res.send(result)
        });

        // add new order 
        app.post('/order',verifyJWT, async (req, res) => {
            const order = req.body;
            const result = await orderCollection.insertOne(order);
            res.send({ success: true, result })
        });

        //get my orders list
        app.get('/myorders',verifyJWT, async (req, res) => {
            const userEmail = req.query.email;
            const decodedEmail = req.decoded.email;
            if(userEmail===decodedEmail){
                const query = { userEmail: userEmail };
                const myOrders = await orderCollection.find(query).toArray();
                res.send(myOrders)   
            }
            else{
                return res.status(403).send({message:'Forbidden access'})
            }
        });


        //cancel my order
        app.delete('/cancelorder/:id',verifyJWT, async (req, res) => {
            const id = req.params.id;
            const filter = {_id: ObjectId(id)}
            const result = await orderCollection.deleteOne(filter);
            res.send(result)
        });


        //get singel order details for payment
        app.get('/order/:id',verifyJWT, async (req, res) => {
            const id = req.params.id;
            const query = {_id: ObjectId(id)}
            const result = await orderCollection.findOne(query);
            res.send(result)
        });


        //update payment info in order object
        app.patch('/order/:id',verifyJWT, async (req, res) => {
            const id = req.params.id;
            const payment = req.body;
            const filter = {_id: ObjectId(id)}
            const updateDoc = {
                $set:{
                    paid:true,
                    transactionId: payment.transactionId
                }
            }
            const updateOrder = await orderCollection.updateOne(filter,updateDoc);
            const updatePayment = await paymentCollection.insertOne(payment)
            res.send(updateOrder)
        });


        //get all orders list for admin
        app.get('/orders',verifyJWT,verifyAdmin, async (req, res) => {
            const query = {}
            const items = await orderCollection.find(query).toArray()
            res.send(items)
        })

        // update shiping info
        app.patch('/shipp/:id',verifyJWT,verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const filter = {_id: ObjectId(id)}
            const updateDoc = {
                $set:{
                    shippment:true,
                }
            }
            const updateOrder = await orderCollection.updateOne(filter,updateDoc);
            res.send(updateOrder)
        });


        //deleteing product by admin
        app.delete('/deletetool/:id',verifyJWT,verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const filter = {_id: ObjectId(id)}
            const result = await toolsCollection.deleteOne(filter);
            res.send(result)
        });


        //get all user for admin
        app.get('/allusers',verifyJWT,verifyAdmin, async (req,res)=>{
            const allUsers = await userCollection.find().toArray();
            res.send(allUsers);
        });


        //make admin a user --admin
        app.put('/makeadmin/:email', verifyJWT,verifyAdmin,async (req, res) => {
            const email = req.params.email;
            const filter = { email: email };
            const updateDoc = {
                $set: {role:'admin'},
            };
            const result = await userCollection.updateOne(filter, updateDoc);
            res.send( result )
        });

        //delete user --- admin
        app.delete('/deleteuser/:email',verifyJWT,verifyAdmin, async (req, res) => {
            const email = req.params.email;
            const filter = {email:email}
            const result = await userCollection.deleteOne(filter);
            res.send(result)
        });

        //add review for user
        app.post('/addreview',verifyJWT, async (req, res) => {
            const order = req.body;
            const result = await reviewCollection.insertOne(order);
            res.send({ success: true, result })
        });

        // add new product  
        app.post('/addproduct',verifyJWT,verifyAdmin, async (req, res) => {
            const order = req.body;
            const result = await toolsCollection.insertOne(order);
            res.send({ success: true, result })
        });

    }
    finally {
    }
}
run().catch(console.dir)


app.get('/', (req, res) => {
    res.send('server started')
})


app.listen(port, () => {
    console.log(`server running on ${port}`)
})
