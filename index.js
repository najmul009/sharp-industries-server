const express = require('express')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express()
const port = process.env.PORT || 5000
const cors = require('cors')
app.use(cors())
app.use(express.json())
require('dotenv').config();


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.nirim.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });




async function run() {
    try {
        await client.connect()
        const toolsCollection = client.db("sharp-db").collection("tools")

        // main route 
        app.get('/tools', async (req, res) => {
            const query = {}
            const cursor = toolsCollection.find(query)
            const items = await cursor.toArray()
            res.send(items)
        })


        // route for single product
        app.get('/tools/:id', async (req, res) => {
            const id = req.params.id;
            const query = {_id: ObjectId(id)}
            const result = await toolsCollection.findOne(query);
            res.send(result)
        })

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
