define(["./dist_axios.min", "./util", "./state"], function (
  axios,
  util,
  state
) {
  let containers = {};
  let createContainer = () => {
    return {
      widgets : {},
      currentPage : 1,
      previousOptions : {},
      selectExcluded : {}
    }
  }
  let getContainer = (extKey) => {
    if (!containers[extKey]) {
      containers[extKey] = createContainer();
    }
    return containers[extKey];
  }

  const getPreviousOptions = (extKey) => {
    return getContainer(extKey).previousOptions;
  }

  const setPreviousOptions = (extKey, value) => {
    getContainer(extKey).previousOptions = value;
  }

  const getWidgets = (extKey) => {
    return getContainer(extKey).widgets;
  }

  const getCurrentPage = (extKey) => {
    return getContainer(extKey).currentPage;
  }

  const setCurrentPage = (extKey, value) => {
    getContainer(extKey).currentPage = value;
  }

  const isSelectExcluded = (extKey, field) => {
    return getContainer(extKey).selectExcluded[field];
  }

  const toggleSelectExcluded = (extKey, field) => {
    const c = getContainer(extKey);
    c.selectExcluded[field] = !c.selectExcluded[field];
  }

  const setSelectExcluded = (extKey, field, value) => {
    getContainer(extKey).selectExcluded[field] = value;
  }

  const getHeaderFilters = (extKey) => {
    return getContainer(extKey).headerFilters;
  }

  const setHeaderFilters = (extKey, value) => {
    getContainer(extKey).headerFilters = value;
  }

  const getUserFilter = (extKey) => {
    return getContainer(extKey).userFilter;
  }

  const setUserFilter = (extKey, value) => {
    getContainer(extKey).userFilter = value;
  }

  const getSelectedOptions = (extKey) => {
    return getContainer(extKey).selectedOptions;
  }

  const getOptionsHolders = (extKey) => {
    return getContainer(extKey).optionsHolders;
  }

  const setOptionsHolders = (extKey, value) => {
    getContainer(extKey).optionsHolders = value;
  }

  const setSelectedOptions = (extKey, selectedFilters) => {
    let so = [];
    if (selectedFilters.length && selectedFilters[0].value) {
      so = selectedFilters[0].value
        .substr(1, selectedFilters[0].value.length - 2)
        .split("','");
    }
    getContainer(extKey).selectedOptions = so;
  }

  const getMouseDownIndex = (extKey) => {
    return getContainer(extKey).mouseDownIndex;
  }

  const setMouseDownIndex = (extKey, value) => {
    getContainer(extKey).mouseDownIndex = value;
  }

  const isShiftClickSelectionStarted = (extKey) => {
    return getContainer(extKey).shiftClickSelectionStarted;
  }

  const toggleShiftClickSelectionStarted = (extKey) => {
    const c = getContainer(extKey);
    c.shiftClickSelectionStarted = !c.shiftClickSelectionStarted;
  }

  function initCancelButton(container, extKey) {
    let cancelFilterBtn = document.createElement("span");
    cancelFilterBtn.classList.add("lui-icon");
    cancelFilterBtn.classList.add("lui-icon--close");
    cancelFilterBtn.addEventListener("click", (e) => {
      container.remove();
    });
    getWidgets(extKey).container.appendChild(cancelFilterBtn);
  }

  function hidePopupAndApplyFilter(context, column, inputValue, applyFilterFlag) {
    const extKey = context.extKey;
    getWidgets(extKey).container.remove();
    if (getColumnFilterValue(column) !== inputValue) {
      context.headersFilter = JSON.parse(
        JSON.stringify(column.getTable().getFilters(true))
      );
      let columnHeaderFilter = context.headersFilter.find(
        (v) => v.field === column.getField()
      );
      if (columnHeaderFilter) {
        columnHeaderFilter.value = inputValue;
      } else {
        context.headersFilter.push({
          field: column.getField(),
          value: inputValue,
          type: util.getColumnFilterType(context, column.getField()),
          notOp: _isNegationTurnedOn(extKey, column.getField())
        });
      }
      column.setHeaderFilterValue(inputValue);
    } else {
      column.getTable().setData();
    }
    state.setActiveColumn(extKey, column.getField());
    state.setApplyFilter(extKey, applyFilterFlag);
  }

  function initApplyButton(context, column) {
    const extKey = context.extKey;
    let applyFilterBtn = (getWidgets(extKey).applyFilterBtn = document.createElement("span"));
    applyFilterBtn.classList.add("lui-icon");
    applyFilterBtn.classList.add("lui-icon--tick");
    applyFilterBtn.addEventListener("click", (e) => {
      applyFilterListener(context, column, true);
    });

    getWidgets(extKey).container.appendChild(applyFilterBtn);
  }

  function applyFilterListener(context, column, applyFilterFlag) {
    const extKey = context.extKey;
    if (getWidgets(extKey).applyFilterBtn.classList.contains("disabled")) {
      return;
    }
    let columnFilter = context.userFilter.find(
      (v) => v.field === column.getField()
    );
    if (!columnFilter) {
      columnFilter = { field: column.getField() };
      context.userFilter.push(columnFilter);
    }
    let filter = [];
    getWidgets(extKey).listOptions.querySelectorAll("li").forEach((li) => {
      if (li.getAttribute("data-selected"))
        filter.push(
          "'" + li.getAttribute("data-value").replaceAll("'", "''") + "'"
        );
    });
    if (_isNegationTurnedOn(extKey, column.getField())) {
      columnFilter.type = "!=";
    } else {
      delete columnFilter.type;
    }
    columnFilter.value = filter.join(",");
    state.getVidgetElems(extKey).idsInput.value = "";
    let inputValue = getWidgets(extKey).input.value;
    hidePopupAndApplyFilter(context, column, inputValue, applyFilterFlag);
  }

  function initClearFilterButton(context, column) {
    const extKey = context.extKey;
    let divider = document.createElement("div");
    divider.classList.add("divider");
    getWidgets(extKey).container.appendChild(divider);
    let clearFilterBtn = (getWidgets(extKey).clearFilterBtn = document.createElement("span"));
    clearFilterBtn.classList.add("lui-icon");
    clearFilterBtn.classList.add("lui-icon--clear-filter");
    clearFilterBtn.addEventListener("click", (e) => {
      let columnFilter = context.userFilter.find(
        (v) => v.field === column.getField()
      );
      if (columnFilter) {
        columnFilter.value = "";
      }
      setSelectExcluded(extKey, column.getField(), false);      
      state.getVidgetElems(extKey).idsInput.value = "";
      hidePopupAndApplyFilter(context, column, "", true);      
    });
    getWidgets(extKey).container.appendChild(clearFilterBtn);
  }

  function initSelectExcludedButton(context, column, data) {
    const extKey = context.extKey;
    let divider = document.createElement("div");
    getWidgets(extKey).container.appendChild(divider);
    let btn = (getWidgets(extKey).selectExcludedBtn = document.createElement("span"));
    btn.classList.add("lui-icon");
    btn.classList.add("lui-icon--select-excluded");
    let field = column.getField();
    if(isSelectExcluded(extKey, field)) {
      btn.classList.add("excluded-on");
    } else {
      btn.classList.remove("excluded-on");
    }
    
    
    btn.addEventListener("click", (e) => {
      toggleSelectExcluded(extKey, field);
      let ul = document.querySelector(".q-table-popup .filter-options");
      ul.classList.toggle("select-inverse");
      if (getWidgets(extKey).input.value.length > 0) {
        handleInputEnter(context, data, column);
      } else {
        if (ul.querySelectorAll("li[data-selected]").length > 0) {
          if(isSelectExcluded(extKey, field)) {
            ul.classList.add("select-inverse");
          } else {
            ul.classList.remove("select-inverse");
          }
        }
      }
      btn.classList.toggle("excluded-on");      
    });
    getWidgets(extKey).container.appendChild(btn);
  }

  function initInput(context, column) {
    const extKey = context.extKey;
    const widgets = getWidgets(extKey);
    widgets.input = document.createElement("input");
    widgets.input.placeholder = "Filter Column...";
    widgets.input.value = getColumnFilterValue(column);
    widgets.container.appendChild(widgets.input);
  }

  function getColumnFilterValue(column) {
    let columnFilter = column
      .getTable()
      .getFilters(true)
      .find((f) => f.field === column.getField());
    return columnFilter ? columnFilter.value || "" : "";
  }

  function createFilterOption(text, extKey) {
    const index = getOptionsHolders(extKey).length - 1;
    let li = document.createElement("li");
    li.setAttribute("data-value", text);
    li.setAttribute("data-index", index);
    li.setAttribute("title", text);
    const setSelectExcludedBtnVisibility = (extKey) => {
      const widgets = getWidgets(extKey);
      const hasSelected = widgets.listOptions.querySelectorAll("li[data-selected]").length > 0;
      const inputFilled = widgets.input.value.length > 0;
      widgets.selectExcludedBtn.style.visibility = hasSelected ||  inputFilled ? "visible" : "hidden";
    }
    li.addEventListener("click", (e) => {
      if (e.shiftKey) {
        toggleShiftClickSelectionStarted(extKey);
        if (!isShiftClickSelectionStarted(extKey)) {
          const widgets = getWidgets(extKey);
          let options = widgets.listOptions.querySelectorAll("li");
          const mouseClickIndex = li.getAttribute("data-index");
          const mouseDownIndex = getMouseDownIndex(extKey);
          let leftB = Math.min(mouseDownIndex, mouseClickIndex);
          let rightB = Math.max(mouseDownIndex, mouseClickIndex);
          for (i = 0; i < options.length; ++i) {
            const holder = getOptionsHolders(extKey)[i];
            const elemLi = holder.element;
            if (i >= leftB && i <= rightB) {
              holder.selected ? elemLi.removeAttribute("data-selected") : elemLi.setAttribute("data-selected", "selected");
            } else {
              holder.selected ? elemLi.setAttribute("data-selected", "selected") : elemLi.removeAttribute("data-selected");
            }
          }
          setSelectExcludedBtnVisibility(extKey);
        }
      }
    });
    li.addEventListener("mousedown", (e) => {
      if (isShiftClickSelectionStarted(extKey)) {
        if (e.shiftKey) {
          return;
        }
        toggleShiftClickSelectionStarted(extKey);  
      }
      setMouseDownIndex(extKey, li.getAttribute("data-index"));
      let options = getWidgets(extKey).listOptions.querySelectorAll("li");
      for (i = 0; i < options.length; ++i) {
        getOptionsHolders(extKey)[i].selected = options[i].getAttribute("data-selected");
      }
      li.getAttribute("data-selected")
        ? li.removeAttribute("data-selected")
        : li.setAttribute("data-selected", "selected");
      setSelectExcludedBtnVisibility(extKey);
    });
    li.addEventListener("mouseenter", (e) => {
      if (e.buttons === 1 && e.shiftKey) {
        const mouseenterIndex = li.getAttribute("data-index");
        let options = getWidgets(extKey).listOptions.querySelectorAll("li");
        let i = 0;
        for (i = 0; i < options.length; ++i) {
          const holder = getOptionsHolders(extKey)[i];
          const elemLi = holder.element;
          const mouseDownIndex = getMouseDownIndex(extKey);
          if (mouseDownIndex <= mouseenterIndex) {
            if (i >= mouseDownIndex && i <= mouseenterIndex) {
              holder.selected ? elemLi.removeAttribute("data-selected") : elemLi.setAttribute("data-selected", "selected");
            } else {
              holder.selected ? elemLi.setAttribute("data-selected", "selected") : elemLi.removeAttribute("data-selected");
            }
          } else {
            if (i <= mouseDownIndex && i >= mouseenterIndex) {
              holder.selected ? elemLi.removeAttribute("data-selected") : elemLi.setAttribute("data-selected", "selected");
            } else {
              holder.selected ? elemLi.setAttribute("data-selected", "selected") : elemLi.removeAttribute("data-selected");
            }
          }  
        }
        setSelectExcludedBtnVisibility(extKey);
      } 
    });
    li.appendChild(document.createTextNode(text));
    return li;
  }

  function spliceFilter(arr, column) {
    const idx = arr.findIndex(
      (v) => v.field === column.getField()
    );
    if (idx > -1) {
      arr.splice(idx, 1);
    }
  }

  function _isNegationTurnedOn(extKey, field) {
    return isSelectExcluded(extKey, field);
  }

  function handleInputEnter(context, data, column) {
    const extKey = context.extKey;
    const widgets = getWidgets(extKey);
    if (widgets.input.value.length > 0) {
      widgets.selectExcludedBtn.style.visibility = "visible";
      let filter = getHeaderFilters(extKey).find(
        (v) => v.field === data.columnName
      );
      if (!filter) {
        filter = { field: data.columnName };
        getHeaderFilters(extKey).push(filter);
        filter.type = util.getColumnFilterType(
          context,
          data.columnName
        );
      }
      filter.value = widgets.input.value;
    } else {
      let hasSelected = widgets.listOptions.querySelectorAll("li[data-selected]").length > 0;
      widgets.selectExcludedBtn.style.visibility = hasSelected ? "visible" : "hidden";
      spliceFilter(getHeaderFilters(extKey), column);
    }
    spliceFilter(getUserFilter(extKey), column);
    
    getSelectedOptions(extKey).splice(0);
    loadColumnData(1, context, data);
  }

  function setFocus() {
    var focusInterval = setInterval(() => {
      let el = document.querySelector(".tabulator-popup-container input")
      if (el) {
        el.focus();
        clearInterval(focusInterval); 
      }  
    }, 200);
  }

  function loadColumnData(page, context, data) {
    let isLoading = true;
    const extKey = context.extKey;
    setTimeout(() => {
      if (isLoading) getWidgets(extKey).loader.classList.add("active");
    }, 200);

    setCurrentPage(extKey, page);
    
    const containsFilterField = !!context.filter.find(fItem => fItem.field === context.filterField);
    let contextFilter = context.filter;
    if (state.isUseJoinTable(extKey) && containsFilterField) {
      contextFilter = context.filter.filter(fItem => fItem.field !== context.filterField);
    }
    let qsFilter = util.excludeNonEmptyDuplicates(contextFilter, getUserFilter(extKey));
    let inputFilter = util.excludeNonEmptyDuplicates(
      getHeaderFilters(extKey),
      getUserFilter(extKey)
    );
    data.filter = [...inputFilter, ...qsFilter, ...getUserFilter(extKey)];
    data.filter.forEach(el => {
      el.notOp = _isNegationTurnedOn(extKey, el.field);
    });
    let currentFilterString = JSON.stringify(data.filter);
    data.page = page;
    if (page === 1) {
      getWidgets(extKey).listOptions.innerHTML = ""; 
      setOptionsHolders(extKey, []);   
      getSelectedOptions(extKey).forEach((option) => {
        let optionHolder = {text: option};
        getOptionsHolders(extKey).push(optionHolder);
        let li = createFilterOption(option, extKey);
        optionHolder.element = li;
        optionHolder.selected = true;
        li.setAttribute("data-selected", "selected");
        getWidgets(extKey).listOptions.appendChild(li);
      });
      if (getWidgets(extKey).selectExcludedBtn) {
        let inputFilled = getWidgets(extKey).input.value.length > 0;
        getWidgets(extKey).selectExcludedBtn.style.visibility = getSelectedOptions(extKey).length > 0 || inputFilled ? "visible" : "hidden";
      }
    }
    let optionsContainer = getPreviousOptions(extKey)[data.columnName];
    if (optionsContainer && currentFilterString === optionsContainer.filter && page === 1 && optionsContainer.options) {
      isLoading = false;
      getWidgets(extKey).loader.classList.remove("active");
      const listOptionsClasses = getWidgets(extKey).listOptions.classList;
      isSelectExcluded(extKey, data.columnName) ? listOptionsClasses.add("select-inverse") : listOptionsClasses.remove("select-inverse");
      fillOptions(optionsContainer.options, data.columnName);
      setCurrentPage(extKey, optionsContainer.page ? optionsContainer.page : 1); 
      setFocus();
      return;
    }
    data.authToken = util.getAuthToken();
    data.idsSession = state.getSessionId(extKey);
    if (!optionsContainer) {
      optionsContainer = {};
      getPreviousOptions(extKey)[data.columnName] = optionsContainer;
    }

    optionsContainer.filter = currentFilterString;
    let showMoreBtn = getWidgets(extKey).showMoreBtn;
    axios
      .post(context.nodeUrl + "/selectColumnDistincts", data, {
        headers: {
          "Content-Type": "application/json",
          AuthId: context.appId,
        }
      })
      .then(function (response) {
        if (response.data.data.length < data.limit) {
          showMoreBtn.setAttribute("disabled", "disabled");
          const isNothingFound =
            response.data.data.length === 0 && page === 1;
          showMoreBtn.value = isNothingFound
            ? "Nothing found"
            : "All options loaded";
          if (isNothingFound) {
            getWidgets(extKey).applyFilterBtn.classList.add("disabled");
          } else {
            getWidgets(extKey).applyFilterBtn.classList.remove("disabled");
          }
        } else {
          showMoreBtn.removeAttribute("disabled");
          showMoreBtn.value = "Show more";
          getWidgets(extKey).applyFilterBtn.classList.remove("disabled");
        }
        optionsContainer.options = page > 1 ? [...optionsContainer.options, ...response.data.data]: response.data.data;
        optionsContainer.page = page;
        fillOptions(response.data.data, data.columnName);
        isLoading = false;
        getWidgets(extKey).loader.classList.remove("active");
        setFocus(); 
      })
      .catch(function (error) {
        console.log(error);
        isLoading = false;
        getWidgets(extKey).loader.classList.remove("active");
        setFocus();
        showMoreBtn.removeAttribute("disabled");
      });

    function fillOptions(optionsValues, columnName) {
      let responseData = optionsValues.filter(
        (option) => !getSelectedOptions(extKey).find((v) => v == option[columnName])
      );
      responseData.forEach((option) => {
        let optionHolder = {text: option[columnName]};
        getOptionsHolders(extKey).push(optionHolder);
        let li = createFilterOption(option[columnName], extKey);
        optionHolder.element = li;
        optionHolder.selected = false;
        getWidgets(extKey).listOptions.appendChild(li);
      });
    }
  }

  return {
    clearStoredOptions: function(extKey) {
      setPreviousOptions(extKey, {});
    },
    isNegationTurnedOn: function(extKey, field) {
      return _isNegationTurnedOn(extKey, field);
    },
    getFormatter: function (context, extKey) {
      context.extKey = extKey;
      return function (e, column, onRendered) {
        setOptionsHolders(extKey, []);
        const { table, profile, limitFilter} = context;
        let data = { table, profile, limit: limitFilter };
        data.sortDirection = "ASC";
        data.columnName = column.getField();
        setHeaderFilters(extKey, column.getTable().getFilters(true)); 
        setUserFilter(extKey, context.userFilter.filter(
          (v) => v.field !== data.columnName
        ));

        let selectedFilters = context.userFilter.filter(
          (v) => v.field === data.columnName
        );
        setSelectedOptions(extKey, selectedFilters);

        let container = (getWidgets(extKey).container = document.createElement("div"));
        container.classList.add("q-table-popup");
        initApplyButton(context, column);
        initCancelButton(container, extKey);
        initClearFilterButton(context, column);
        initSelectExcludedButton(context, column, data);
        initInput(context, column);

        let listOptions = (getWidgets(extKey).listOptions = document.createElement("ul"));
        listOptions.classList.add("filter-options");
        container.appendChild(listOptions);

        let showMoreBtn = (getWidgets(extKey).showMoreBtn = document.createElement("input"));
        showMoreBtn.classList.add("show-more-btn");
        showMoreBtn.classList.add("enabled");
        showMoreBtn.type = "button";
        showMoreBtn.value = "Show more";
        showMoreBtn.addEventListener("click", (e) => {
          showMoreBtn.setAttribute("disabled", "disabled");
          loadColumnData(getCurrentPage(extKey) + 1, context, data);
        });
        getWidgets(extKey).container.appendChild(showMoreBtn);

        let shadowLine = document.createElement("div");
        shadowLine.classList.add("shadow-line");

        let loader = (getWidgets(extKey).loader = document.createElement("div"));
        loader.classList.add("pg-rest-loader");
        let loaderIcon = document.createElement("img");
        loaderIcon.setAttribute(
          "src",
          "/extensions/dvsts-pg-rest-table/svg/loaderIcon.svg"
        );
        loader.appendChild(loaderIcon);
        loader.appendChild(shadowLine);
        getWidgets(extKey).container.appendChild(loader);

        loadColumnData(1, context, data);

        getWidgets(extKey).input.addEventListener("keyup", (e) => {
          if (e.key !== "Enter") {
            var val = getWidgets(extKey).input.value;
            setTimeout(() => {
              if (getWidgets(extKey).input.value === val) {
                handleInputEnter(context, data, column);
              }   
            }, 500);
            return;
          }
          handleInputEnter(context, data, column);
        });

        return container;
      };
    },
    emptyHeaderFilter: function () {
      return document.createElement("div");
    },
  };
});
