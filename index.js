require("dotenv").config();
const express = require("express");
const app = express();
const jwt = require("jsonwebtoken");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const cors = require("cors");
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.5rfjgim.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    const mealsCollection = client.db("hotelierDb").collection("meals");
    const upcomingMealsCollection = client
      .db("hotelierDb")
      .collection("upcoming-meals");
    const userCollection = client.db("hotelierDb").collection("users");
    const badgeCollection = client.db("hotelierDb").collection("badge");
    const paymentCollection = client.db("hotelierDb").collection("payments");

    // jwt related api
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });
      res.send({ token });
    });

    // middlewares
    const verifyToken = (req, res, next) => {
      console.log("inside verify token", req.headers.authorization);
      if (!req.headers.authorization) {
        return res.status(401).send({ message: "unAuthorized access" });
      } else {
        const token = req.headers.authorization.split(" ")[1];
        jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
          if (err) {
            return res.status(401).send({ message: "unAuthorized access" });
          }
          req.decoded = decoded;
          next();
        });
      }
    };

    // use verify admin after verifyToken
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      const isAdmin = user?.role === "admin";
      if (!isAdmin) {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };
    // user related api
    app.get("/users", verifyToken, verifyAdmin, async (req, res) => {
      // console.log(req.headers);
      const result = await userCollection.find().toArray();
      res.send(result);
    });
    app.get("/users/:email", async (req, res) => {
      // console.log(req.headers);
      const email = req.params.email;
      const query = { email: email };
      const result = await userCollection.findOne(query);
      res.send(result);
    });
    app.get("/users/admin/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      // if (email !== req.decoded.email) {
      //   return res.status(403).send({ message: "forbidden access" });
      // }
      const query = { email: email };
      const user = await userCollection.findOne(query);
      let admin = false;
      if (user) {
        admin = user?.role === "admin";
      }
      res.send({ admin });
    });
    app.patch("/users/:email", async (req, res) => {
      const email = req.params.email;
      const filter = { email: email };
      const options = { upsert: true };
      const user = req.body;
      const updateDoc = {
        $set: {
          badge: user.badge,
        },
      };
      const result = await userCollection.updateOne(filter, updateDoc, options);
      res.send(result);
    });
    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "user already exist", insertedId: null });
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    });
    app.patch("/users/admin/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: "admin",
        },
      };
      const result = await userCollection.updateOne(filter, updateDoc);
      res.send(result);
    });
    app.delete("/users/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await userCollection.deleteOne(query);
      res.send(result);
    });

    //  meals related api
    app.get("/meals", async (req, res) => {
      const result = await mealsCollection.find().toArray();
      res.send(result);
    });
    app.post("/meals", async (req, res) => {
      const item = req.body;
      const result = await mealsCollection.insertOne(item);
      res.send(result);
    });
    //  specific meal by id
    app.get("/meal/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await mealsCollection.findOne(query);
      res.send(result);
    });
    app.put("/meals/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const meal = req.body;
      const updateDoc = {
        $set: {
          title: meal.title,
          admin_name: meal.admin_name,
          admin_email: meal.admin_email,
          likes: meal.likes,
          date: meal.date,
          reviews: meal.reviews,
          ingredients: meal.ingredients,
          category: meal.category,
          price: meal.price,
          rating: meal.rating,
          description: meal.description,
        },
      };
      const result = await mealsCollection.updateOne(
        filter,
        updateDoc,
        options
      );
      res.send(result);
    });
    app.delete("/meals/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await mealsCollection.deleteOne(query);
      res.send(result);
    });

    // upcoming meal related api
    app.get("/upcoming-meals", async (req, res) => {
      const result = await upcomingMealsCollection.find().toArray();
      res.send(result);
    });
    app.post("/upcoming-meals", async (req, res) => {
      const item = req.body;
      const result = await upcomingMealsCollection.insertOne(item);
      res.send(result);
    });

    // badge related api
    app.get("/badge", async (req, res) => {
      const result = await badgeCollection.find().toArray();
      res.send(result);
    });

    app.get("/badge/:package_name", async (req, res) => {
      const packageName = req.params.package_name;
      const result = await badgeCollection.findOne({
        package_name: packageName,
      });
      res.send(result);
    });

    // payment intent api
    app.post("/create-payment-intent", async (req, res) => {
      const { price } = req.body;
      // console.log("price", price);
      const amount = parseInt(price * 100);
      // console.log(amount, "amount inside the intent");
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });
    app.post("/payments", async (req, res) => {
      const payment = req.body;
      const paymentResult = await paymentCollection.insertOne(payment);
      console.log("payment Info", payment);
      res.send(paymentResult);
    });
    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // console.log(
    //   "Pinged your deployment. You successfully connected to MongoDB!"
    // );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hotelier is running");
});

app.listen(port, () => {
  console.log(`Hotelier is running on ${port}`);
});
