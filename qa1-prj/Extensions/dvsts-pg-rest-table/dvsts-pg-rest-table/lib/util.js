define(["qlik", "./enigma", "text!../data/schema.json"], function (
  qlik,
  enigma,
  schema
) {
  var authToken;
  var tokenVariableName;
  var schemaObj = JSON.parse(schema);
  var appId = qlik.currApp(this).id;
  const vproxyCandidate = window.location.pathname.split('/')[1];
  const baseUrl = vproxyCandidate && vproxyCandidate !== 'sense' ? `${window.location.hostname}/${vproxyCandidate}` : `${window.location.hostname}`;

  async function getAuthPromise() {
    var res = await getVariableValueByName(tokenVariableName);
    authToken = (res && res.qText) || authToken;
    return authToken;
  }

  async function getVariableValueByName(name) {
    if (!name) return;    
    var session = enigma.create({
      schema: schemaObj,
      url: `wss://${baseUrl}/app/engineData`,
      createSocket: (url) => new WebSocket(url),
    });

    try {
      var global = await session.open();
      var res = null;
      try{
        var doc = await global.openDoc(appId);
        var sv = await doc.getVariableByName({ qName: name });
        res = await sv.getLayout();
      } catch (e) {
        console.log(`Failed to get variable value by name "${name}"`);
        console.log(e);
      }
      await session.close();
      return res;
    } catch (e) {
      console.log(e);
      await session.close();
      return null;
    }
  }

  async function setVariableValueByName(name, value) {
    if (!name) return;    
    var session = enigma.create({
      schema: schemaObj,
      url: `wss://${baseUrl}/app/engineData`,
      createSocket: (url) => new WebSocket(url),
    });
    try {
      var global = await session.open();
      try{
        var doc = await global.openDoc(appId);
        var v = await doc.getVariableByName(name);
        var props = await v.getProperties();
        props.qDefinition = value;
        await v.setProperties(props);
      } catch (e) {
        console.log(e);
      }
      await session.close();
    } catch (e) {
      console.log(e);
      await session.close();
    }
  }

  async function processVariableValueByName(name, callback) {
    var res = await getVariableValueByName(name)
    callback(res);
  }
  return {
    excludeNonEmptyDuplicates: function (src, subtrahend) {
      return src.filter(
        (f) =>
          !subtrahend.find((uf) => f.field === uf.field && uf.value.length > 0 && !f.notOp)
      );
    },
    getAuthPromise: getAuthPromise,
    getAuthToken: function () {
      return authToken;
    },
    processVariableValueByName,
    setVariableValueByName,
    getColumnFilterType: (context, columnName) => {
      /*let colInfo = JSON.parse(context.colInfo).columns.find(
        (v) => v.name === columnName
      );
      return colInfo && colInfo.filterFunc === "tsquery" ? "keywords" : "like";*/
      return "like";
    },
    setVariableName: (name) => {
        tokenVariableName = name;
    }
  };
});
