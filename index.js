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


//note: you must use require('dotenv').config() before use any environment variables
//requiring stripe key
const stripe = require('stripe')(process.env.STRIPE_SECRETS)

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

        const bookingCollection = client.db('zooom-vrooom-iGarage').collection('booking');

        const paymentCollection = client.db('zooom-vrooom-iGarage').collection('payment');



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
                const token = jwt.sign({ email }, process.env.ACCESS_TOKEN, { expiresIn: "23h" })

                return res.send({ accessToken: token });
            }
            res.status(403).send({ accessToken: "" })
        });


        /*
Stripe API
*/
        app.post('/create-payment-intents', async (req, res) => {
            const booking = req.body;
            const price = booking.price;
            const amount = price * 100;

            const paymentIntent = await stripe.paymentIntents.create({
                currency: 'usd',
                amount: amount,
                "payment_method_types": [
                    "card"
                ]
            })


            res.send({
                clientSecret: paymentIntent.client_secret
            })
        })


        //storing transation details to database

        app.post('/payments', async (req, res) => {
            const payment = req.body
            const result = await paymentCollection.insertOne(payment)

            const id = payment.bookingId
            const filter = { _id: new ObjectId(id) }
            const updatedDoc = {
                $set: {
                    paid: "true",
                    transactionId: payment.transactionId
                }
            }
            const updateResult = await bookingCollection.updateOne(filter, updatedDoc)
            res.send(result)
        })


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

        //delete any specific user
        app.delete("/user/delete/:id", verifyJWT, verifyAdmin, async (req, res) => {

            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };

            const result = await usersCollection.deleteOne(filter);
            res.send(result)
        })
        //add new admin by other admin
        // app.put('/users/admin/:id', async (req, res) => {
        //     const id = req.query.id;
        //     const filter = { _id: ObjectId(id) }

        //     const options = { upsert: true };

        //     const updatedDoc = {
        //         $set: {
        //             role: 'admin'
        //         }
        //     }
        //     const result = await usersCollection.updateOne(filter, updatedDoc, options);
        //     res.send(result);
        // })

        app.get('/users/verification/:email', async (req, res) => {
            const email = req.params.email
            const query = { email };
            const users = await usersCollection.find(query).toArray();
            res.send(users);
        });

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

        //product to database
        app.post('/product', verifyJWT, async (req, res) => {
            const product = req.body;
            const result = await productsCollection.insertOne(product)
            res.send(result);
        })


        //category wise products loader
        app.get("/advertised", async (req, res) => {
            const query = { isAdvertised: "true", status: "unsold" };
            const products = await productsCollection.find(query).toArray();
            res.send(products)
        })

        //put reported item on products collection
        app.put('/product/reported/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;

            const filter = { _id: new ObjectId(id) }

            const options = { upsert: true };

            const updatedDoc = {
                $set: {
                    report: 'true'
                }
            }
            const result = await productsCollection.updateOne(filter, updatedDoc, options);
            res.send(result);
        })

        //ftech reported product for admin
        app.get('/product/allReported', verifyJWT, verifyAdmin, async (req, res) => {
            const filter = { report: "true" };

            const result = await productsCollection.find(filter).toArray();
            res.send(result)
        })

        //delete reported products

        app.delete('/product/delete/:id', verifyJWT, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const result = await productsCollection.deleteOne(filter);
            res.send(result)
        })


        //validate user as Admin with hook "useAdmin"
        app.get('/users/authorization/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;
            const query = { email }
            const user = await usersCollection.findOne(query);
            res.send({ isAuthorized: user.role });
            // res.send(user.role);
        })


        //private route of dashboard for seller,buyer,admin with hook "useDashAuth"
        //role authorization
        app.get('/role/authorization/:role/:email', async (req, res) => {
            const email = req.params.email;
            const role = req.params.role;
            const query = { email };
            console.log(role)
            const user = await usersCollection.findOne(query);
            if (user.role === role) {
                res.send({ acknowledge: true })
            }
            else {
                res.send({ acknowledge: false })
            }
        })

        //list of buyer or seller as an admin
        app.get('/users/authorized/:authorization', verifyJWT, verifyAdmin, async (req, res) => {
            const authorization = req.params.authorization;
            const query = { role: authorization }
            const user = await usersCollection.find(query).toArray();
            res.send(user);
        })

        //to verify user as verified,option is only limited to admin
        app.put('/user/verification/:id', verifyJWT, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) }

            const options = { upsert: true };

            const updatedDoc = {
                $set: {
                    verified: 'true'
                }
            }
            const result = await usersCollection.updateOne(filter, updatedDoc, options);
            res.send(result);
        })

        //fetch my product for seller email address
        app.get('/seller/product/:email', verifyJWT, async (req, res) => {

            const email = req.params.email;
            const query = { sellerEmail: email }
            const result = await productsCollection.find(query).toArray();
            res.send(result)

        })

        //to advertised product as seller
        app.put('/product/advertise/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) }

            const options = { upsert: true };

            const updatedDoc = {
                $set: {
                    isAdvertised: 'true'
                }
            }
            const result = await productsCollection.updateOne(filter, updatedDoc, options);
            res.send(result);
        })

        //booking reqest to DB
        app.post('/booking', verifyJWT, async (req, res) => {
            const booking = req.body;
            const result = await bookingCollection.insertOne(booking)
            res.send(result);
        })
        //fetch booking for buyer
        app.get('/booking/:email', verifyJWT, async (req, res) => {

            const email = req.params.email;
            const query = { buyerEmail: email };
            const booking = await bookingCollection.find(query).toArray();
            res.send(booking)
        })
        //fetch booking for buyer
        app.get('/bookingId/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const booking = await bookingCollection.findOne(query);
            res.send(booking)
        })

        //syncing product information to database
        app.put('/payment/success/:bookingId', verifyJWT, async (req, res) => {
            const bookingId = req.params.bookingId;

            const filter = { productId: bookingId }
            const idFIltering = { _id: new ObjectId(bookingId) }
            const options = { upsert: true };

            const updatedDoc = {
                $set: {
                    payment: 'true'
                }
            }

            const updatedProduct = {
                $set: {
                    status: 'sold'
                }
            }


            const result = await bookingCollection.updateOne(filter, updatedDoc, options);

            const productStatus = await productsCollection.updateOne(idFIltering, updatedProduct, options,)

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
    console.log(`Zooom Vroom iGarage server running on port ${port} `)
})