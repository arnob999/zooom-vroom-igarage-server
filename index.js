const express = require('express');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 5000;

//requiring jsonWebToken
const jwt = require("jsonwebtoken")

require('dotenv').config()


const { MongoClient, ServerApiVersion } = require('mongodb');

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