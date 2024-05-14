define([
  "qlik",
  "./lib/painter",
  "./lib/util",
  "text!./data/schema.json",
  "css!./css/tabulator.min.css",
  "css!./css/table.css",
], function (qlik, painter, util, schema) {
  let table = {
    ref: "props.table",
    label: "Table",
    type: "string",
    expression: "optional",
  };

  let profile = {
    ref: "props.profile",
    label: "Profile",
    type: "string",
    expression: "optional",
  };

  let limit = {
    ref: "props.limit",
    label: "Rows on page",
    type: "string",
    expression: "optional",
  };

  let limitFilter = {
    ref: "props.limitFilter",
    label: "Max number of filters items",
    type: "string",
    expression: "optional",
  };

  let colInfo = {
    ref: "props.colInfo",
    label: "Columns info",
    type: "string",
    expression: "optional",
  };

  let filterField = {
    ref: "props.filterField",
    label: "Filter field",
    type: "string",
    expression: "optional",
  };

  let nodeUrl = {
    ref: "props.nodeUrl",
    label: "REST Url",
    type: "string",
    expression: "optional",
  };

  let tokenVariableName = {
    ref: "props.tokenVariableName",
    label: "Token variable name",
    type: "string",
    expression: "optional",
  };

  let columnsOrderVariableName = {
    ref: "props.columnsOrderVariableName",
    label: "Columns order variable name",
    type: "string",
    expression: "optional",
  }

  let enableCount = {
    ref: "props.enableCount",
    label: "Enable count of rows",
    type: "boolean",
    defaultValue: true
  }

  // Appearance section
  let appearanceSection = {
    uses: "settings",
    items: {
      table,
      profile,
      limit,
      limitFilter,
      colInfo,
      filterField,
      nodeUrl,
      tokenVariableName,
      columnsOrderVariableName,
      enableCount
    },
  };
  function updateToken() {
    return util.getAuthPromise();
  }

  
  setInterval(updateToken, 25000);

  return {
    definition: {
      type: "items",
      component: "accordion",
      items: {
        appearance: appearanceSection,
      },
    },
    initialProperties: {},
    support: {
      export: false, 
      exportData : false
    },
    paint: function ($element, layout) {
      console.log("paint");
      try {
        util.setVariableName(layout.props.tokenVariableName);
        painter.paintImpl($element, layout);        
      } catch (e) {
        console.log(e);
      }
    },
  };
});
