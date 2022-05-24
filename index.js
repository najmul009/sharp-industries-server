const express = require('express')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express();
const jwt = require('jsonwebtoken');
const port = process.env.PORT || 5000
const cors = require('cors')
app.use(cors())
app.use(express.json())
require('dotenv').config();


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

        // main route 
        app.get('/tools', async (req, res) => {
            const query = {}
            const cursor = toolsCollection.find(query)
            const items = await cursor.toArray()
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
