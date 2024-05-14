define([
  "qlik",
  "./popupFormatter",
  "./util",
  "./state",
  "./tabulator.min",
  "./dist_axios.min",
  "./xlsx"
], function (qlik, popupFormatter, util, state, tabulator, axios, xlsx) {
  let containers = {};
  let createContainer = (extKey) => {
    return {
      user : {},
      scrollLeft : 0,
      selectionStart : 0,
      selectionStartRows : [],
      filterJustApplied : false,
      shiftClickSelectionStarted: false,
      vidgetElems: state.getVidgetElems(extKey),
      filterExtPainter: {},
      selectionPosition: {}
    }
  }

  let getContainer = (extKey) => {
    if (!containers[extKey]) {
      containers[extKey] = createContainer(extKey);
    }
    return containers[extKey];
  }

  let getUser = (key) => {
    return getContainer(key).user;
  }

  let getScrollLeft = (key) => {
    return getContainer(key).scrollLeft;
  }

  let setScrollLeft = (key, scrollLeft) => {
    getContainer(key).scrollLeft = scrollLeft;
  }

  let getTable = (key) => {
    return getContainer(key).table
  }
  let setTable = (key, table) => {
    return getContainer(key).table = table;
  }

  let getContext = (key) => {
    return getContainer(key).context;
  }
  let setContext = (key, context) => {
    getContainer(key).context = context;
  }

  let getVidgetElems = (key) => {
    return getContainer(key).vidgetElems;
  }

  let getFilterJustApplied = (key) => {
    return getContainer(key).filterJustApplied;
  }

  let setFilterJustApplied = (key, filterJustApplied) => {
    getContainer(key).filterJustApplied = filterJustApplied;
  }

  let getFilterExtPainter = (key) => {
    return getContainer(key).filterExtPainter;
  }

  let getPossibleFilterFieldLockId = (key) => {
    return getContainer(key).possibleFilterFieldLockId;
  }

  let setPossibleFilterFieldLockId = (key, possibleFilterFieldLockId) => {
    getContainer(key).possibleFilterFieldLockId = possibleFilterFieldLockId;
  }

  let getSelectionStart = (key) => {
    return getContainer(key).selectionStart;
  }
  let setSelectionStart = (key, selectionStart) => {
    getContainer(key).selectionStart = selectionStart;
  }

  let getSelectionPosition = (key) => {
    return getContainer(key).selectionPosition;
  }

  let isSelectionStartRowsIncludes = (key, i) => {
    return getContainer(key).selectionStartRows.includes(i);
  }

  let setSelectionStartRows = (key, selectionStartRows) => {
    getContainer(key).selectionStartRows = selectionStartRows;
  }

  let isShiftClickSelectionStarted = (key) => {
    return getContainer(key).shiftClickSelectionStarted;
  }

  let toggleShiftClickSelectionStarted = (key) => {
    const value = getContainer(key).shiftClickSelectionStarted;
    getContainer(key).shiftClickSelectionStarted = !value;
  }

  var px_ratio = window.devicePixelRatio || window.screen.availWidth / document.documentElement.clientWidth;
  window.addEventListener("resize", (event) => {
    var newPx_ratio = window.devicePixelRatio || window.screen.availWidth / document.documentElement.clientWidth;
    if(newPx_ratio != px_ratio){
        px_ratio = newPx_ratio;
        if (table) {
          const height = table.element.parentElement.offsetHeight - 45;
          table.setHeight(height);
        }
    }
  });

  let showAlert = (message, extKey) => {
    let vidgetElems = getVidgetElems(extKey);
    vidgetElems.alertObj.style.display = "flex";
    if (message) {
      vidgetElems.alertObj.firstChild.innerHTML = message;
    }
  }

  let hideAlert = (clearTableAlert, extKey) => {
    let vidgetElems = getVidgetElems(extKey);
    let table = getTable(extKey);
    if (clearTableAlert && table){ 
      table.clearAlert();
    }
    vidgetElems.alertObj.style.display = "none";
    vidgetElems.alertObj.firstChild.innerHTML = "Loading";
  }

  let getSelectedColumnsNames = function(extKey) {
    let selectedColNames = [];
    if (getFilterExtPainter(extKey).selectionObject) {
      selectedColNames = getFilterExtPainter(extKey).selectionObject.qSelections.map(
        (v) => v.qField
      );
    }
    return selectedColNames;
  }
  
  let hasExternalFiltersFunc = function(columns, selectedColNames) {
    let useAPIFilter = columns.find(col => col.useAPIFilter);
    let hasExternalFilters = false;
    console.log(selectedColNames);
    if(selectedColNames) {
      const selectedColumns = selectedColNames.map(name => columns.find(col => col.name  === name || col.filter === name));
      if (useAPIFilter) {
        hasExternalFilters = selectedColumns.findIndex(column => !column || !column.useAPIFilter) !== -1;
      } else {
        hasExternalFilters = selectedColumns.findIndex(column => !column || column.name === 'number') !== -1;
      }
    }
    return hasExternalFilters;
  }

  let loadDataByFilter = function(alertLock, filter, loadData, extKey) {
    const context = getContext(extKey);
    const prevFilterStr = JSON.stringify(context.filter);
    const currentFilterStr = JSON.stringify(filter);
    context.filter = filter;
    if (prevFilterStr !==  currentFilterStr && !getFilterJustApplied(extKey)) {
      popupFormatter.clearStoredOptions(extKey);
      context.userFilter = [];
      context.headersFilter = [];
      util.getAuthPromise().then(()=>{
        if (getTable(extKey)) {
          getTable(extKey).clearFilter(true); 
        } else {
          loadData();
        }
      });
    } else {
      if (prevFilterStr !==  currentFilterStr) {
        setFilterJustApplied(extKey, false);
      }
      hideAlert(true, extKey);
    }
    alertLock.showAlert = false;
  }

  let loadSelectedFilterData = function(alertLock, selectedColNames, loadData, app, extKey) {
    const context = getContext(extKey);
    let columns = JSON.parse(context.colInfo).columns;
    let watcherParams = {};
    selectedColNames.forEach(cName => {
      watcherParams[cName] =  {
        qStringExpression: `=chr(39) & concat({$<${cName}=$::${cName}>}distinct replace(${cName}, chr(39), chr(39)&chr(39)), chr(39)&','&chr(39)) & chr(39)`,
      }
    });
    const bTime = new Date();
    console.log(`Before create generic object time: ${bTime}, instance key: ${extKey}`);
    let genObj = app.createGenericObject(watcherParams, (reply) => {
      const afTime = new Date();
      console.log(`Get reply from generic object at: ${afTime}, instance key: ${extKey}`);
      console.log(`Difference: ${afTime - bTime} ms, instance key: ${extKey}`);
      try {
        let filter = selectedColNames.map(cName => {
          let col = columns.find(col => col.name  === cName || col.filter === cName);
          let colName = col ? col.name : "";
          return { field: colName, value: reply[cName] }
        });
        state.setUseJoinTable(extKey, false);
        loadDataByFilter(alertLock, filter, loadData, extKey)
        app.destroySessionObject(reply.qInfo.qId);
      } catch (e) {
        console.log(e);
      }
    });
  }

  let loadDataByPossibleFilterField = function(alertLock, loadData, app, extKey) {
    let selectLockId = Date.now();
    var cName = getContext(extKey).filterField;
    var exprChoice = "P"; //excludedCount > 0 && excludedCount * 10 < parseInt(cReply.included) ? "E" : "P";
    let watcherParams = {};
    watcherParams[cName] = {
      qStringExpression: `=chr(39) & concat({1<${cName}=${exprChoice}({$}${cName})>}distinct replace(${cName}, chr(39), chr(39)&chr(39)), chr(39)&','&chr(39)) & chr(39)`,
    };
    setPossibleFilterFieldLockId(extKey, `${selectLockId}`);
    const bTime = new Date();
    console.log(`Before create generic object time: ${bTime}, instance key: ${extKey}`);
    let genObj = app.createGenericObject(watcherParams, (reply) => {
      const afTime = new Date();
      console.log(`Get reply from generic object at: ${afTime}, instance key: ${extKey}`);
      console.log(`Difference: ${afTime - bTime} ms, instance key: ${extKey}`);
      loadDataByGenericObjectReply(reply, app, selectLockId, alertLock, loadData, extKey);
    });
  }

  let loadDataByGenericObjectReply = async function(reply, app, selectLockId, alertLock, loadData, extKey) {
    try {
      const context = getContext(extKey);
      console.log(`loadDataByGenericObjectReply: ${context.profile}`);
      var cName = context.filterField;
      let filter = [{
        field: cName,
        value: reply[cName]
      }];
      var idsSrc = reply[cName].split(",");
      if (idsSrc.length > 1000) {
        const colArray = JSON.parse(context.colInfo).columns;
        const idColumn = colArray.find(cInfo => cInfo.name === cName);
        const areIdsNumbers = idColumn.type === "number";
        const idsAll = idsSrc.map(idSrc => areIdsNumbers ? parseInt(idSrc.slice(1, -1)) : idSrc.slice(1, -1));
        const prevFilterStr = JSON.stringify(context.filter);
        const appliedFilterStr = context.appliedFilter ? JSON.stringify(context.appliedFilter) : null;
        const currentFilterStr = JSON.stringify(filter);
        const filtersNotEqual = appliedFilterStr ? currentFilterStr !== appliedFilterStr : prevFilterStr !==  currentFilterStr;
        if (!getFilterJustApplied(extKey) && filtersNotEqual) {
          state.setUseJoinTable(extKey, true);
          popupFormatter.clearStoredOptions(extKey);
          const authToken = util.getAuthToken() || await util.getAuthPromise();
          if (`${selectLockId}` !== getPossibleFilterFieldLockId(extKey)) {
            console.log('prevent unnecessary insert');
            return;
          }
          state.generateNewSessionId(extKey);
          console.log(`new session id: ${state.getSessionId(extKey)} generated for extKey: ${extKey} and profile: ${context.profile}`);
          let data = {
            profile: context.profile,
            tableName: "incidents",
            idColumn: {name: cName, type: idColumn.type},
            idsSession: state.getSessionId(extKey),
            browserSession: state.getBrowserSession(),
            authToken: authToken,
          };
          const batchSize = 200000;
          data.ids = idsAll.slice(0, Math.min(batchSize, idsAll.length));
          if (idsAll.length < batchSize) {
            data.finalInsert = true;
          }
          data.firstInsert = true;
          console.log(`first insert ids: ${context.profile}`);
          const insertResp = await axios.post(context.nodeUrl + "/insertIds", data, {
            headers: {
              "Content-Type": "application/json",
              AuthId: context.appId,
            }
          });
          if (insertResp && insertResp.status !== "Cancelled" && idsAll.length > batchSize) {
            insertOtherIds(data, idsAll, batchSize, selectLockId, extKey);
          }
          if (`${selectLockId}` !== getPossibleFilterFieldLockId(extKey)) {
            console.log('prevent unnecessary select');
            return;
          }
          loadDataByFilter(alertLock, filter, loadData, extKey);
        } else {
          if (getFilterJustApplied(extKey)) {
            context.appliedFilter = filter;
            setFilterJustApplied(extKey, false);
          }
          hideAlert(true, extKey);
          alertLock.showAlert = false;
        }
      } else {
        if (`${selectLockId}` !== getPossibleFilterFieldLockId(extKey)) {
          console.log('prevent unnecessary select');
          return;
        }
        state.setUseJoinTable(extKey, false);
        loadDataByFilter(alertLock, filter, loadData, extKey)
      }
      
      app.destroySessionObject(reply.qInfo.qId);
    } catch (e) {
      hideAlert(true, extKey);
      if (e.message) {
        showAlert(e.message, extKey);
        setTimeout(()=>hideAlert(true, extKey), 5000);
      }
      console.log(e);
    }
  }

  let insertOtherIds = async function(data, idsAll, batchSize, selectLockId, extKey) {
    const batchCount = idsAll.length / batchSize;
    for (var i = 1; i< batchCount; i++) {
      if (`${selectLockId}` !== getPossibleFilterFieldLockId(extKey)) {
        console.log('prevent unnecessary insert');
        return;
      }
      if (i+1 >= batchCount) {
        data.finalInsert = true;
      }
      data.ids = idsAll.slice(i*batchSize, Math.min((i+1)*batchSize, idsAll.length));
      data.firstInsert = false;
      const context = getContext(extKey);
      console.log(`${i+1}s insert ids: ${context.profile}`);
      const response =  await axios.post(context.nodeUrl + "/insertIds", data, {
        headers: {
          "Content-Type": "application/json",
          AuthId: context.appId,
        }
      });
      if (response && response.status === "Cancelled") {
        break;
      }
    }
  } 

  let watchSelection = function (app, loadData, extKey) {
    let context = getContext(extKey);
    let columns = JSON.parse(context.colInfo).columns;
    let selectedColNames = getSelectedColumnsNames(extKey);

    var alertLock = {showAlert: true};
    setTimeout(function() {
      try {
        if (alertLock.showAlert ) {
          if (getTable(extKey)) {
            getTable(extKey).alert("Loading");
          } else {
            showAlert(false, extKey);
          }
        }
      } catch (e) {
        console.log(e);
      }
    }, 500);

    if (!selectedColNames.length) {
      state.setUseJoinTable(extKey, false);
      loadDataByFilter(alertLock, [], loadData, extKey);
      return;
    }

    let hasExternalFilters = hasExternalFiltersFunc(columns, selectedColNames);
    console.log(`hasExternalFilters: ${hasExternalFilters}, extension instance: ${extKey}`);
    if (!hasExternalFilters) {
      loadSelectedFilterData(alertLock, selectedColNames, loadData, app, extKey);
    } else {
      loadDataByPossibleFilterField(alertLock, loadData, app, extKey);
    }
  };

  let getData = (context) => {
    const { table, profile, limit } = context;
    return { table, profile, limit };
  };


  let initTableCallback = ($element, currApp, extKey) => {
    const context = getContext(extKey);
    if (!context) {
      console.log(`Error: No extension context found for key:${extKey}`);
    }
    hideAlert(false, extKey);
    context.userFilter = [];
    context.headersFilter = [];
    try {
      let data = getData(context);
      let columnsInfo = JSON.parse(context.colInfo);
      let filterField = context.filterField || "incident_number";
      context.filterColIsNum = columnsInfo.columns.find(col => col.name === filterField)?.type === 'number';
      if (getTable(extKey) && getTable(extKey).destroy) getTable(extKey).destroy();
      let newTable = new tabulator(getVidgetElems(extKey).tableContainer, {
        height: Math.trunc($element.height()) - 45,
        layout: "fitDataFill",
        autoColumns: true,
        autoColumnsDefinitions: function (definitions) {
          //definitions - array of column definition objects
          definitions.forEach((column) => {
            let colInfo = columnsInfo.columns.find(
              (v) => v.name === column.field
            );
            column.visible = Boolean(colInfo);
            column.tooltip = colInfo ? colInfo.tooltip : false;
            column.headerPopup = popupFormatter.getFormatter(context, extKey); 
            if (colInfo && colInfo.linkPrefix) {
              column.formatter = "link";
              column.formatterParams =  {
                labelField:"number",
                urlPrefix: colInfo.linkPrefix,
                urlField: colInfo.linkField || colInfo.name,
                target:"_blank",
              };
            }
            
            if (colInfo && colInfo.hideSorting) {
              column.headerSort = false;
            }
            let userFilter = context.userFilter.find(
              (v) => v.field === column.field
            );
            let headerFilter;
            if (context.headersFilter) {
              headerFilter = context.headersFilter.find(
                (v) => v.field === column.field
              );
            }
            if (
              (userFilter && userFilter.value) ||
              (headerFilter && headerFilter.value)
            ) {
              column.headerPopupIcon = `<i class="lui-icon lui-icon--search green" data-column-name="${column.field}" title="Search"></i>`;
            } else {
              column.headerPopupIcon = `<i class="lui-icon lui-icon--search" data-column-name="${column.field}" title="Search"></i>`;
            }
            column.headerFilter = popupFormatter.emptyHeaderFilter;
            column.headerFilterFunc =
              colInfo && colInfo.filterFunc === "tsquery" ? "keywords" : "like";
            if (colInfo && colInfo.title) {
              column.title = colInfo.title;
            }
            column.maxWidth = columnsInfo.columnMaxWidth ? columnsInfo.columnMaxWidth : 500;
          });

          return definitions;
        },
        sortMode: "remote",
        filterMode: "remote",
        movableColumns: true,
        pagination: true, //enable pagination
        paginationMode: "remote",
        paginationSize: parseInt(data.limit),
        paginationSizeSelector: [10, 25, 50, 100, 200],
        paginationButtonCount: context.enableCount ? 5: 1,
        paginationCounter: context.enableCount ? "rows" : undefined,
        ajaxResponse:function(url, params, response){
            //url - the URL of the request
            //params - the parameters passed with the request
            //response - the JSON object returned in the body of the response.
            console.log(`Insert in progress flag: ${response["insert_in_progress"]}`);
            if (response["insert_in_progress"]) {
              getVidgetElems(extKey).loadInProgressInfo.innerText = "Inserting data in progress. Press 'Clear All filters' button later to work with complete data.";
            } else {
              getVidgetElems(extKey).loadInProgressInfo.innerText = "";
            }
            state.setCountOfRows(extKey, response["last_row"]);
            return [response]; //return the data property of a response json object
        },
        ajaxURL: context.nodeUrl + "/selectByConfig",
        ajaxConfig: "POST", //ajax HTTP request type
        ajaxContentType: {
          headers: {
            "Content-Type": "application/json",
            AuthId: context.appId,
          },
          body: function (url, config, params) {
            const bodyJson = getData(context);
            console.log(`context.filter below:`);
            console.log(context.filter);
            const containsFilterField = !!context.filter.find(fItem => fItem.field === filterField);
            var contextFilter = context.filter;
            if (state.isUseJoinTable(extKey) && containsFilterField) {
              contextFilter = context.filter.filter(fItem => fItem.field !== filterField);
            }
            let qsFilter = util.excludeNonEmptyDuplicates(
              contextFilter,
              context.userFilter
            );
            params.filter.forEach(el => {
              el.notOp = popupFormatter.isNegationTurnedOn(extKey, el.field);
            });
            let inputFilter = util.excludeNonEmptyDuplicates(
              params.filter,
              context.userFilter
            );
            bodyJson.filter = [
              ...qsFilter,
              ...inputFilter,
              ...context.userFilter,
            ];
            bodyJson.filter.forEach(el => {
              el.notOp = popupFormatter.isNegationTurnedOn(extKey, el.field);
            });
            bodyJson.limit = params.size;
            bodyJson.columns = getColumns(columnsInfo, context);
            if (params.sort && params.sort.length > 0) {
              bodyJson.sort = params.sort;
            } else {
              bodyJson.sort = [{ field: filterField, dir: "DESC" }];
            }
            if (params.page) {
              bodyJson.page = params.page;
            }
            bodyJson.authToken = util.getAuthToken();
            bodyJson.enableCount = context.enableCount;
            bodyJson.idsSession = containsFilterField ? state.getSessionId(extKey) : 0;
            bodyJson.browserSession = state.getBrowserSession();
            return JSON.stringify(bodyJson);
          },
        },
      });
      setTable(extKey, newTable);
      const table = getTable(extKey);
      const user = getUser(extKey)
      table.on("dataLoaded", function (data) {
        let filterIcons = document.querySelectorAll(
          ".tabulator-header-popup-button i"
        );
        filterIcons.forEach((icon) => icon.classList.remove("green"));
        let filters = [...context.userFilter, ...context.headersFilter];
        let fields = filters.filter((f) => f.value).map((f) => f.field);
        fields.forEach((f) => {
          document
            .querySelector(
              `.tabulator-header-popup-button i[data-column-name="${f}"]`
            )
            .classList.add("green");
        });
        getVidgetElems(extKey).idsInput.value = "";
        if (state.isApplyFilter(extKey)) {
          applyFilters(false, currApp, extKey);
          state.setApplyFilter(extKey, false);
        }
        return data;
      });
      table.on("dataProcessed", function() {
        if (state.getActiveColumn(extKey)) {
          table.scrollToColumn(state.getActiveColumn(extKey), "middle", false);
          state.setActiveColumn(extKey, undefined);
        } else {
          if (getScrollLeft(extKey)) {
            var activeColumn;
            table.element.querySelectorAll('.tabulator-col').forEach(el => {
              if (!activeColumn && el.offsetLeft + el.offsetWidth > getScrollLeft(extKey) + 30) {
                activeColumn = el.getAttribute("tabulator-field");
              }
            });
            table.scrollToColumn(activeColumn, "left", true);
            console.log(`scrollLeft: ${getScrollLeft(extKey)}`);
          }
        }
      });
      table.on("columnMoved", function(column, columns){
        let fields = columns.filter(column => column._column && column._column.visible).map(column => column._column ? column._column.field : "")
        user.fields = fields;
        context.columnsOrder = fields;
        util.getAuthPromise().then(() => {
          const userData = {
            profile: context.profile,
            directory: user.userDirectory,
            userId: user.userId, 
            fields: JSON.stringify(user.fields),
            authToken: util.getAuthToken()
          };
          axios.post(context.nodeUrl + "/insertUserData", userData, {
            headers: {
              "Content-Type": "application/json",
              AuthId: context.appId,
            }
          });
        });
        console.log(user);
      });
      table.on("rowClick", function(e, row){
        if (!e.shiftKey) {
          return;
        }
        const selectionPosition = getSelectionPosition(extKey);
        let curPos = row._row.position;
        toggleShiftClickSelectionStarted(extKey);
        if (isShiftClickSelectionStarted(extKey)) {
          selectionPosition.top = curPos;
          selectionPosition.bottom = curPos;
          setSelectionStart(extKey, curPos);
        } else {
          selectionPosition.top = Math.min(curPos, selectionPosition.top);
          selectionPosition.bottom = Math.max(curPos, selectionPosition.bottom);
          let leftB = Math.min(getSelectionStart(extKey), curPos);
          let rightB = Math.max(getSelectionStart(extKey), curPos);
          let allRange = [];
          let i = selectionPosition.top;
          for (i = selectionPosition.top; i <= selectionPosition.bottom; i++) {
            allRange.push({idx: i, selected: isSelectionStartRowsIncludes(extKey, i), inSelection: i >= leftB && i <= rightB});
          }
          let toSelect = allRange.filter(obj => (!obj.selected && obj.inSelection) || (obj.selected && !obj.inSelection)).map(obj => table.getRowFromPosition(obj.idx));
          table.selectRow(toSelect);
          let toDeselect = allRange.filter(obj => (obj.selected && obj.inSelection) || (!obj.selected && !obj.inSelection)).map(obj => table.getRowFromPosition(obj.idx));
          table.deselectRow(toDeselect); 
        }
        console.log(`row click: ${curPos}`);
        console.log(`row click selection started: ${isShiftClickSelectionStarted(extKey)}`);
      }
      );
      table.on("rowMouseDown", function(e, row){
        if (isShiftClickSelectionStarted(extKey)) {
          if (e.shiftKey) {
            return;
          }
          toggleShiftClickSelectionStarted(extKey);  
        }
        let curPos = row._row.position;
        const selectionPosition = getSelectionPosition(extKey);
        selectionPosition.top = curPos;
        selectionPosition.bottom = curPos;
        if (e.shiftKey) {
          setSelectionStartRows(extKey, table.getSelectedRows().map(row => row._row.position));
        }
        row.toggleSelect();
        setSelectionStart(extKey, row._row.position);
        console.log(row._row.position);
        //e - the event object
        //row - row component
      });
      table.on("rowMouseEnter", function(e, row){
        if (e.buttons === 1 && e.shiftKey) {
          let curPos = row._row.position;
          const selectionPosition = getSelectionPosition(extKey);
          selectionPosition.top = Math.min(curPos, selectionPosition.top);
          selectionPosition.bottom = Math.max(curPos, selectionPosition.bottom); 
          let leftB = Math.min(getSelectionStart(extKey), curPos);
          let rightB = Math.max(getSelectionStart(extKey), curPos);
          let allRange = [];
          let i = selectionPosition.top;
          for (i = selectionPosition.top; i <= selectionPosition.bottom; i++) {
            allRange.push({idx: i, selected: isSelectionStartRowsIncludes(extKey, i), inSelection: i >= leftB && i <= rightB});
          }
          let toSelect = allRange.filter(obj => (!obj.selected && obj.inSelection) || (obj.selected && !obj.inSelection)).map(obj => table.getRowFromPosition(obj.idx));
          table.selectRow(toSelect);
          let toDeselect = allRange.filter(obj => (obj.selected && obj.inSelection) || (!obj.selected && !obj.inSelection)).map(obj => table.getRowFromPosition(obj.idx));
          table.deselectRow(toDeselect);
        }
      });
      table.on("scrollHorizontal", function(left){
        if (left === 0 && getScrollLeft(extKey) > 10) return; 
        setScrollLeft(extKey, left);
      });
    } catch (e) {
      console.log(e);
    }
  };

  function getColumns(columnsInfo, context) {
    const cInfoNames = columnsInfo.columns.map((c) => c.name);
    const fields = context.columnsOrder.length ? context.columnsOrder : cInfoNames;
    const hasOrderOnlyDiff = cInfoNames.length === fields.length && cInfoNames.every(name => fields.find(field => field === name));
    const visibleColumns = hasOrderOnlyDiff ? fields : cInfoNames;
    const hiddenColumns = columnsInfo.columns.map((c) => c.linkField).filter(lf => lf).filter(lf => !visibleColumns.find(vc => vc === lf));
    return visibleColumns.concat(hiddenColumns);
  }

  function AppendVidgetElems($element, extKey) {
    const { idsInput, selectButton, exportButton, clearFilterButton, tableContainer, alertObj, loadInProgressInfo } =
      getVidgetElems(extKey);
    $element.append(idsInput);
    $element.append(selectButton);
    $element.append(exportButton);
    $element.append(clearFilterButton);
    $element.append(loadInProgressInfo);
    $element.append(tableContainer);
    $element.append(alertObj);
  }

  function initTable($element, app, extKey) {
    util.getAuthPromise().then(() => {
      let context = getContext(extKey);
      const user = getUser(extKey)
      const userData = {
        profile: context.profile,
        directory: user.userDirectory,
        userId: user.userId, 
        authToken: util.getAuthToken()
      };
      axios.post(context.nodeUrl + "/selectUserData", userData, {
        headers: {
          "Content-Type": "application/json",
          AuthId: context.appId,
        }
      }).then(function (response) {
        try {
          const data = response.data.data;
          if (data && data.length) {
            console.log(data);
            context.columnsOrder = JSON.parse(data[0].fields);  
          } else {
            context.columnsOrder = [];
          }
          initTableCallback($element, app, extKey);
        } catch (e) {
          console.log(e);
        }
      });
    });
  }

  async function processExportQuery(alertLock, bodyJson, extKey) {
    const context = getContext(extKey);
    let columnsInfo = JSON.parse(context.colInfo);
    bodyJson.columns = getColumns(columnsInfo, context);
    let columnTitles = bodyJson.columns.map((c) => {
      let fel = columnsInfo.columns.find(el => c === el.name);
      return fel && (fel.name || fel.title);
    }).filter(lf => lf);
    bodyJson.columnTitles = columnTitles;
    var response = await axios
    .post(context.nodeUrl + "/selectByConfig", bodyJson, {
      headers: {
        "Content-Type": "application/json",
        AuthId: context.appId,
      }
    });    
    download(`${context.nodeUrl}/download/${response.data.browserSession}`, 'incidents.csv', extKey);
    alertLock.showAlert = false;
    hideAlert(false, extKey);
  }

  const download = async (url, filename, extKey) => {
    let loadInProgressInfo = getVidgetElems(extKey);
    loadInProgressInfo.innerText = "Download of export file started";
    const data = await fetch(url)
    const blob = await data.blob()
    const objectUrl = URL.createObjectURL(blob)

    const link = document.createElement('a')

    link.setAttribute('href', objectUrl)
    link.setAttribute('download', filename)
    link.style.display = 'none'

    document.body.appendChild(link)
  
    link.click()
  
    document.body.removeChild(link);
    loadInProgressInfo.innerText = "";
  }

  const exportIds = (extKey) => {
    if (state.getCountOfRows(extKey) && state.getCountOfRows(extKey) > 1000000) {
      showAlert("Unable to export more than 1 million rows. Please narrow down your selection", extKey);
      setTimeout(function() {
        hideAlert(false, extKey);
      }, 4000);
      return;
    }
    const context = getContext(extKey);
    const bodyJson = getData(context);
    let filterField = context.filterField || "incident_number";
    const containsFilterField = !!context.filter.find(fItem => fItem.field === filterField);
    var contextFilter = context.filter;
    if (state.isUseJoinTable(extKey) && containsFilterField) {
      contextFilter = context.filter.filter(fItem => fItem.field !== filterField);
    }
    let qsFilter = util.excludeNonEmptyDuplicates(
      contextFilter,
      context.userFilter
    );
    const table = getTable(extKey);
    let headerFilters = table.getFilters(true);
    let inputFilter = util.excludeNonEmptyDuplicates(
      headerFilters,
      context.userFilter
    );
    bodyJson.filter = [
      ...qsFilter,
      ...inputFilter,
      ...context.userFilter,
    ];
    bodyJson.limit = 1000000;
    if (table.getSorters() && table.getSorters().length > 0) {
      bodyJson.sort = table.getSorters();
    } else {
      bodyJson.sort = [{ field: filterField, dir: "DESC" }];
    }
    bodyJson.page = 1;
    bodyJson.authToken = util.getAuthToken();
    bodyJson.enableCount = context.enableCount;
    bodyJson.idsSession = containsFilterField ? state.getSessionId(extKey) : 0;
    bodyJson.browserSession = state.getBrowserSession();
    var alertLock = {};
    alertLock.showAlert = true;
    setTimeout(function() {
      if(alertLock.showAlert) {
        showAlert(false, extKey);
      }
    }, 500);
    processExportQuery(alertLock, bodyJson, extKey)
  }

  const haveInnerFilters = (extKey) => {
    const table = getTable(extKey);
    const context = getContext(extKey);
    var ids = table.getSelectedData();
    let headerFilters = table.getFilters(true);
    let userFilter = context.userFilter.filter(fItem => fItem.value !== '')
    return headerFilters.length + userFilter.length + ids.length !== 0;
  }

  const applyFilters = (showAlertFlag, currApp, extKey) => {
    const { profile, filterField, filter, userFilter, nodeUrl } = getContext(extKey);
    if (!haveInnerFilters(extKey)) {
      currApp
              .field(filterField)
              .selectValues([], false, true);
      hideAlert(false, extKey);
      console.log("Have no filters to apply");
      return;
    }
    const table = getTable(extKey);
    let headerFilters = table.getFilters(true);
    const context = getContext(extKey);
    const containsFilterField = !!context.filter.find(fItem => fItem.field === context.filterField);
    let contextFilter = filter;
    if (state.isUseJoinTable(extKey) && containsFilterField) {
      contextFilter = filter.filter(fItem => fItem.field !== context.filterField);
    }
    let qsFilter = util.excludeNonEmptyDuplicates(contextFilter, userFilter);
    let inputFilter = util.excludeNonEmptyDuplicates(
      headerFilters,
      userFilter
    );
    let filterParam = [...qsFilter, ...inputFilter, ...userFilter];
    let data = {
      profile,
      table: context.table,
      idsSession: state.getSessionId(extKey),
      columnName: filterField,
      filter: filterParam,
      authToken: util.getAuthToken(),
    };
    try {
      if (table.getSelectedData().length) {
        var ids = table.getSelectedData().map(el => el[context.filterField]);
        if (context.filterColIsNum) {
          ids = ids.map(el => 0 + el);
        }
        currApp.field(filterField).selectValues(ids, false, true);
      } else {
        let columns = JSON.parse(context.colInfo).columns;
        let apiColumns = columns.filter(col => col.useAPIFilter);
        let onlyAPI = apiColumns.length > 0 && filterParam.length > 0;
        filterParam.forEach(p => {
          if(!apiColumns.find(c => c.name === p.field)) {
            onlyAPI = false;
          }
        });
        if (onlyAPI) {
          data.columns = filterParam.map(p => p.field);
          if (showAlertFlag) {
            showAlert(false, extKey);
          }
          axios
          .post(nodeUrl + "/selectColumns", data, {
            headers: {
              "Content-Type": "application/json",
              AuthId: context.appId,
            }
          })
          .then(function (response) {
            if (response.data.data.length) {
              Object.keys(response.data.data[0]).forEach(c => {
                var colConf = columns.find(col => col.name === c);
                var arr = response.data.data.map(row => row[c]);
                if (colConf && colConf.type === "date") {
                  arr = arr.map(s => {
                    return 25569 + new Date(s).getTime()/86400000;
                  });
                }
                currApp
                .field(c)
                .selectValues(arr, false, true);
                setFilterJustApplied(extKey, true);
                hideAlert(false, extKey);
              });
            }
          })
          .catch((e) => {
            console.log(e);
            hideAlert(false, extKey);
          });
        } else {
          if (showAlertFlag) {
            showAlert(false, extKey);
          }
          axios
          .post(nodeUrl + "/selectIds", data, {
            headers: {
              "Content-Type": "application/json",
              AuthId: context.appId,
            }
          })
          .then(function (response) {
            currApp
              .field(filterField)
              .selectValues(response.data.data, false, true);
            setFilterJustApplied(extKey, true);
            hideAlert(false, extKey);
          })
          .catch((e) => {
            console.log(e);
            hideAlert(false, extKey);
          });
        }
      }
    } catch (e) {
      console.log(e);
    }
  }

  return {
    paintImpl: function ($element, layout) {
      let that  = this;
      let extKey = layout.props.profile;
      let app = qlik.currApp(this);
      app.global.getAuthenticatedUser(function(reply){
          const user = getUser(extKey);
          reply.qReturn.split('; ').forEach(it => user[it.split('=')[0]] = it.split('=')[1]);
          user.userId = user.UserId;
          user.userDirectory = user.UserDirectory;
      });
      const loadData = () => {
        try {
          if ($element[0].offsetParent === null) {
            return;
          }
          getTable(extKey) ? getTable(extKey).replaceData() : initTable($element, app, extKey);
        }catch (e) {
          console.log(e);
        } 
      };
      setContext(extKey, getContext(extKey) || { ...layout.props, appId: app.id });
      const context = getContext(extKey);
      if (context.enableCount) {
        $element.removeClass("pagination-disabled");
      } else {
        $element.addClass("pagination-disabled");
      }

      let vidgetElems = getVidgetElems(extKey);
      if (Object.keys(vidgetElems).length === 0) {        
        setContext(extKey, { ...layout.props, appId: app.id });
        let idsInput = document.createElement("input");
        idsInput.setAttribute("type", "hidden");

        let selectButton = document.createElement("button");
        selectButton.classList.add("q-select-button");
        selectButton.classList.add("lui-icon");
        selectButton.classList.add("lui-icon--tick");
        selectButton.appendChild(document.createTextNode("  "));
        let loadInProgressInfo = document.createElement("div");
        loadInProgressInfo.classList.add("q-progress-info");

        let tableContainer = document.createElement("div");
        tableContainer.classList.add("q-table-con");

        let alertObj = document.createElement("div");
        alertObj.classList.add("q-alert-obj");
        alertObj.style.display = "none";
        let alertObjMsg = document.createElement("div");
        alertObjMsg.classList.add("q-alert-obj-msg");
        alertObjMsg.innerText = "Loading";
        alertObj.appendChild(alertObjMsg);

        let exportButton = document.createElement("button");
        exportButton.classList.add("q-export-button");
        exportButton.classList.add("lui-icon");
        exportButton.classList.add("lui-icon--download");
        exportButton.appendChild(document.createTextNode("  "));

        let clearFilterButton = document.createElement("button");
        clearFilterButton.classList.add("q-clear-filter-button");
        clearFilterButton.classList.add("lui-icon");
        clearFilterButton.classList.add("lui-icon--clear-filter");
        clearFilterButton.appendChild(document.createTextNode(""));

        Object.assign(vidgetElems, {
          idsInput,
          selectButton,
          tableContainer,
          alertObj,
          loadInProgressInfo,
          exportButton,
          clearFilterButton
        });

        AppendVidgetElems($element, extKey);
        let listener = function (ev) {
          app.getObjectProperties("CurrentSelection").then(function (model) {
            try {
              getFilterExtPainter(extKey).selectionObject = model.layout.qSelectionObject;
              if (ev && ev.triggerWatchSelection) {
                watchSelection(app, loadData, extKey);
              }
            } catch (e) {
              console.log(e);
            }
          });
        };
        listener({triggerWatchSelection : true});

        let selState = app.selectionState();
        selState.OnData.bind(listener);
        clearFilterButton.addEventListener("click", (ev) => {
          Object.keys(containers).forEach(k => {
            getContext(k).userFilter = [];
            getContext(k).headersFilter = [];
            getTable(k).clearHeaderFilter();
          });
          applyFilters(true, qlik.currApp(that), extKey);
        });
        exportButton.addEventListener("click", (ev) => {
          exportIds(extKey);
        });
        selectButton.addEventListener("mouseenter", (ev) => {
          if (haveInnerFilters(extKey)) {
            ev.target.style.cursor = "pointer";
          } else {
            ev.target.style.cursor = "default";
          }
        });

        selectButton.addEventListener("click", (ev) => {
          applyFilters(true, qlik.currApp(that), extKey);
        });
      } else {
        if (!$element.html()) {
          AppendVidgetElems($element, extKey);
          setTimeout(() => {
            getTable(extKey) ? getTable(extKey).redraw(true) : initTable($element, app, extKey);
            hideAlert(false, extKey);
            watchSelection(app, loadData, extKey);
          });
        } else {
          watchSelection(app, loadData, extKey);
        }
      }
    },
  };
});
