const express = require("express");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const app = express();
app.use(express.json());
const dbPath = path.join(__dirname, "covid19IndiaPortal.db");
let db = null;
const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("server running");
    });
  } catch (e) {
    console.log("DB Error");
  }
};
initializeDBAndServer();
//function
const convertDB = (state) => {
  return {
    stateId: state.state_id,
    stateName: state.state_name,
    population: state.population,
  };
};
//function2
const convertDisDB = (district) => {
  return {
    districtId: district.district_id,
    districtName: district.district_name,
    stateId: district.state_id,
    cases: district.cases,
    cured: district.cured,
    active: district.active,
    deaths: district.deaths,
  };
};
//loginApi
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `
   select * from user where username = '${username}';`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatch = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatch === true) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "secret");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});
//middleWareFunction
const authenticateToken = (request, response, next) => {
  let jwtToken = "";
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "secret", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};
//getAllStates
app.get("/states/", authenticateToken, async (request, response) => {
  const allStatesQuery = `select * from state order by state_id;`;
  const states = await db.all(allStatesQuery);
  response.send(states.map((eachState) => convertDB(eachState)));
});
//getStateByStateId
app.get("/states/:stateId/", authenticateToken, async (request, response) => {
  const { stateId } = request.params;
  const stateQuery = `select * from state where state_id = ${stateId};`;
  const state = await db.get(stateQuery);
  response.send(convertDB(state));
});
//createDistrict
app.post("/districts/", authenticateToken, async (request, response) => {
  const districtDetails = request.body;
  const {
    districtName,
    stateId,
    cases,
    cured,
    active,
    deaths,
  } = districtDetails;
  const addDistrictQuery = `
   insert into district(district_name,state_id,cases,cured,active,deaths) values ('${districtName}','${stateId}','${cases}','${cured}','${active}','${deaths}');`;
  const addDistrict = await db.run(addDistrictQuery);
  response.send("District Successfully Added");
});
//districtByDistrictId
app.get(
  "/districts/:districtId",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistrictQuery = `
   select * from district where district_id = ${districtId};`;
    const district = await db.get(getDistrictQuery);
    const newDistrict = convertDisDB(district);
    response.send(newDistrict);
  }
);
//deleteDistrict
app.delete(
  "/districts/:districtId",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteDistrict = `
   delete from district where district_id = ${districtId};`;
    await db.get(deleteDistrict);
    response.send("District Removed");
  }
);
//updateDistrict
app.put(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const districtDetails = request.body;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = districtDetails;
    const updateDistrict = `
   update district set district_name='${districtName}',state_id = '${stateId}',cases='${cases}',cured='${cured}',active='${active}',deaths='${deaths}' where district_id = ${districtId};`;
    await db.run(updateDistrict);
    response.send("District Details Updated");
  }
);
//stateStats
app.get(
  "/states/:stateId/stats/",
  authenticateToken,
  async (request, response) => {
    const { stateId } = request.params;
    const getStateStats = `
   select sum(cases),sum(cured),sum(active),sum(deaths) from district where state_id = ${stateId};`;
    const stats = await db.get(getStateStats);
    console.log(stats);
    response.send({
      totalCases: stats["sum(cases)"],
      totalCured: stats["sum(cured)"],
      totalActive: stats["sum(active)"],
      totalDeaths: stats["sum(deaths)"],
    });
  }
);
module.exports = app;
