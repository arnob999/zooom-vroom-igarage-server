const express = require('express');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 5000;

//requiring jsonWebToken
const jwt = require("jsonwebtoken")

require('dotenv').config()


const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

//first of all open node by put command "node" from cmd
//require('crypto').randomBytes(64).toString("hex")

//environment variable


//2 middleware
app.use(cors());
app.use(express.json());


//main jwt verifying function
function verifyJWT(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(401).send('unauthorized access');
    }

    //detaching authorization secret
    //because we send token with a text bearer in front
    const token = authHeader.split(" ")[1]

    jwt.verify(token, process.env.ACCESS_TOKEN, function (err, decoded) {
        if (err) {
            return res.status(403).send({ message: "forbidden access" })
        }

        req.decoded = decoded;

        next();
    })
}

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.xgfn0ly.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {

    try {

        const usersCollection = client.db('zooom-vrooom-iGarage').collection('users');

        const categoryCollection = client.db('zooom-vrooom-iGarage').collection('category');

        const productsCollection = client.db('zooom-vrooom-iGarage').collection('products');


        //middleWare for verifying admin
        //note: make sure you use verifyAdmin after use verifyJWT

        const verifyAdmin = async (req, res, next) => {
            const decodedEmail = req.decoded.email;

            const query = { email: decodedEmail };
            const user = await usersCollection.findOne(query);

            if (user?.role !== "admin") {
                return res.status(403).send({ message: "forbidden access" })
            }

            next();
        }


        //generating jwt
        app.get('/jwt', async (req, res) => {
            const email = req.query.email;
            const query = { email: email };
            const user = await usersCollection.findOne(query);

            if (user) {
                const token = jwt.sign({ email }, process.env.ACCESS_TOKEN, { expiresIn: "1h" })

                return res.send({ accessToken: token });
            }
            res.status(403).send({ accessToken: "" })
        });

        //user to database
        app.post('/users', async (req, res) => {
            const user = req.body;

            const result = await usersCollection.insertOne(user)
            res.send(result);
        })

        //get all user
        app.get('/users', async (req, res) => {
            const query = {};
            const users = await usersCollection.find(query).toArray();
            res.send(users);
        });
        //add new admin by other admin
        app.put('/users/admin/:id', async (req, res) => {
            const id = req.query.id;
            const filter = { _id: ObjectId(id) }

            const options = { upsert: true };

            const updatedDoc = {
                $set: {
                    role: 'admin'
                }
            }
            const result = await usersCollection.updateOne(filter, updatedDoc, options);
            res.send(result);
        })

        //category loader
        app.get("/category", async (req, res) => {
            const query = {};
            const category = await categoryCollection.find(query).toArray();
            res.send(category)
        })
        //category wise products loader
        app.get("/category/:catId", async (req, res) => {
            const categoryId = req.params.catId
            const query = { catId: categoryId };
            const products = await productsCollection.find(query).toArray();

            res.send(products)
        })

        //put reported item on products collection
        app.put('/product/reported/:id', async (req, res) => {
            const id = req.query.id;
            const filter = { _id: ObjectId(id) }

            const options = { upsert: true };

            const updatedDoc = {
                $set: {
                    report: 'true'
                }
            }
            const result = await productsCollection.updateOne(filter, updatedDoc, options);
            res.send(result);
        })

    }


    finally {

    }

}
run().catch(err => console.log(err))


app.get('/', (req, res) => {
    res.send("Zooom Vroom iGarage running successfully")
})

app.listen(port, () => {
    console.log(`Zooom Vroom iGarage server running on port ${port}`)
})