const express = require('express');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 5000;


//require('crypto').randomBytes(64).toString("hex")

// require('dotenv').config()
//2 middleware
app.use(cors());
app.use(express.json());



async function run() {

    try {


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