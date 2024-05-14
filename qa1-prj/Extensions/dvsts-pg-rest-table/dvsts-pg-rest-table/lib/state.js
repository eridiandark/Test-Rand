define([], function () {
  var sessionId = {};
  var browserSession = self.crypto.randomUUID();
  var vidgetElemsHolder = {};
  const holders = {};
  const getHolder = (extKey) => {
    if (!holders[extKey]) {
      holders[extKey] = {};
    }
    return holders[extKey];
  }
  return {
    getCountOfRows: function(key) {
      return getHolder(key).countOfRows;
    },
    getActiveColumn: function(key) {
      return getHolder(key).activeColumn;
    },
    isApplyFilter: function(key) {
      return getHolder(key).applyFilter;
    },
    setCountOfRows: function(key, value) {
      getHolder(key).countOfRows = value;
    },
    setActiveColumn: function(key, value) {
      getHolder(key).activeColumn = value;
    },
    setApplyFilter: function(key, value) {
      getHolder(key).applyFilter = value;
    },
    getVidgetElems: function(key) {
      if (!vidgetElemsHolder[key]) {
        vidgetElemsHolder[key] = {};
      }
      return vidgetElemsHolder[key];
    },
    setVidgetElems: function(key, vidgetElems) {
      vidgetElemsHolder[key] = vidgetElems;
    },
    isUseJoinTable: function(key) {
      return getHolder(key).useJoinTable;
    },
    setUseJoinTable: function(key, value) {
      getHolder(key).useJoinTable = value;
    },

    generateNewSessionId: function(extKey) {
      sessionId[extKey] = self.crypto.randomUUID();
    },
    getSessionId: function(extKey) {
      return this.isUseJoinTable(extKey) ? sessionId[extKey] : 0;
    },
    getBrowserSession: function() {
      return browserSession;
    }    
  };
});
