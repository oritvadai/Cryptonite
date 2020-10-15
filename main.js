/// <reference path="jquery-3.4.1.js" />

"use strict";

$(() => {
    // the maximum number of followed coins
    const maxFollowed = 5;

    // cash coin objects (more info) that were viewed in the last 2 minutes
    let coinCache = {};

    // selected coins for viewing graphs
    let followedCoins = [];

    // save the possibly new last coin instead of the removed one
    let extraCoin = null;

    // all the coin objects recieved from the ajax call
    let globalCoinList = null;

    // live data for all followed coins
    let graphData = [];

    // interval object for refreshing the graph every 2 seconds
    let graphRefresh = null;

    // string for creating spinners while loading data
    const spinnerHtml = `
    <div class="d-flex justify-content-center spinner1">
        <div class="spinner-border" role="status">
            <span class="sr-only">Loading...</span>
        </div>
    </div>`

    function createPage() {
        // add html content
        let body = $("body");
        body.append(
            `<div class="modal fade" id="unfollowModal" tabindex="-1" role="dialog" 
            aria-labelledby="exampleModalLabel" aria-hidden="true">
                <div class="modal-dialog" role="document">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title" id="unfollowModalLabel">Coin limit reached</h5>
                            <!-- <button type="button" class="close" data-dismiss="modal" aria-label="Close">
                                <span aria-hidden="true">&times;</span>
                            </button> -->
                        </div>
                        <div class="modal-body" id="unfollowModalBody">
                            You may select up to ${maxFollowed} coins to be tracked in real time. <br />
                            Please remove one or more of the following coins or press cancel to remove your last selection.
                        </div>
                        <div class="modal-footer">
                            <button id="cancelModal" type="button" class="btn btn-secondary" 
                            data-dismiss="modal">Cancel</button>
                            <button id="saveModal" type="button" class="btn btn-success">Save changes</button>
                        </div>
                    </div>
                </div>
            </div>
            <nav class="navbar navbar-expand-md navbar-light bg-light">
                <button class="navbar-toggler" type="button" data-toggle="collapse" data-target="#navbarSupportedContent"
                    aria-controls="navbarSupportedContent" aria-expanded="false" aria-label="Toggle navigation">
                    <span class="navbar-toggler-icon"></span>
                </button>
                <div class="collapse navbar-collapse" id="navbarSupportedContent">
                    <ul class="navbar-nav mr-auto">
                        <li class="nav-item">
                            <button class="btn btn-light" id="homeBtn">Home</button>
                        </li>
                        <li class="nav-item">
                            <button class="btn btn-light" id="liveReportsBtn">Live Reports</button>
                        </li>
                        <li class="nav-item">
                            <button class="btn btn-light" id="aboutBtn">About</button>
                        </li>
                    </ul>
                    <form id="searchForm" class="form-inline">
                        <input class="form-control mr-sm-2" id="searchInput" type="search" placeholder="Search"
                            aria-label="Search">
                        <button class="btn btn-success my-2 my-sm-0" id="searchBtn" type="button">Search</button>
                    </form>
                </div>
            </nav>
            <div class="parallax">
                <header id="title">
                    <h1>Cryptonite</h1>
                </header>
            </div>`
        );

        // create divs for each tab
        let home = $('<div/>', { id: "home", class: "container-fluid" });
        body.append(home);
        home.append($('<div/>', { id: "coinNotFound" }));

        let allCoins = $('<div/>', { id: "allCoins", class: "row justify-content-center" });
        // append spinners where needed
        allCoins.append(spinnerHtml);
        home.append(allCoins);

        let liveReports = $('<div/>', { id: "liveReports" });
        body.append(liveReports);
        let graphSpinner = $('<div/>', { id: "graphSpinner" });
        graphSpinner.append(spinnerHtml);
        liveReports.append(graphSpinner);
        let noGraphData = $('<div/>', { id: "noGraphData" });
        liveReports.append(noGraphData);
        let selectCoinsMsg = $(`<p>Please select coins on the <a href="javascript:void(0)">Home</a> tab</p>`);
        noGraphData.append(selectCoinsMsg);
        selectCoinsMsg.click(() => goHome());
        liveReports.append($('<div/>', { id: "partialGraphData" }));
        liveReports.append($('<div/>', { id: "graphContainer" }));
        liveReports.hide();

        let about = $('<div/>', { id: "about" });
        about.append(
            `<div id="aboutCard" class="card mb-3 mx-auto">
                <div class="row no-gutters">
                    <div class="col-md-12 col-lg-6">
                        <div class="card-body">
                            <h5 class="card-title">Created by: Orit Vadai</h5>
                            <p class="card-text">
                                This project allows the user to retrieve information on various crypto-currencies.<br/>
                                Coin values are displayed in ILS, Euro, and Dollar currencies.<br/>
                                The user may select up to five coins to track and compare in real time on a graph.
                            </p>
                        </div>
                    </div>
                    <div class="col-md-12 col-lg-6">
                        <img src="img/Orit_and_Ebony.jpg" class="card-img" alt="Orit and Ebony">
                    </div>
                    
                </div>
            </div>`
        );
        body.append(about);
        about.hide();
    };

    // changes the view to "home"
    function goHome(showAllChildren = true) {
        if (showAllChildren) {
            $("#allCoins").children().show();
        }
        $("#about").hide();
        $("#liveReports").hide();
        $("#coinNotFound").empty();
        $("#home").show();
        resetGraph();
    };

    function registerEvents() {
        // menu buttons
        $("#homeBtn").click(() => {
            goHome();
        });
        $("#liveReportsBtn").click(() => {
            $("#about").hide();
            $("#home").hide();
            $("#noGraphData").hide();
            $("#graphContainer").hide();
            $("#graphSpinner").show();
            $("#liveReports").show();
            resetGraph();
            displayLiveReports();
        });
        $("#aboutBtn").click(() => {
            $("#home").hide();
            $("#liveReports").hide();
            $("#about").show();
            resetGraph();
        });
        $("#searchBtn").click(() => onSearch());
        $("#searchForm").submit(() => {
            onSearch();
            return false;
        });
        $("#saveModal").click(() => onModalSave());
    };

    // disable/enable save changes button
    function onModalToggle() {
        let numChecked = followedCoins.filter((coin) => $(`#follow_${coin.id}_modal`).is(":checked")).length
        if (numChecked >= maxFollowed) {
            $("#saveModal").attr("disabled", true);
        } else {
            $("#saveModal").attr("disabled", false);
        }
    };

    // handle click on save button
    function onModalSave() {
        // remove unselected coin(s) from array
        followedCoins = followedCoins.filter((coin) => $(`#follow_${coin.id}_modal`).is(":checked"));
        if (followedCoins.length >= maxFollowed) {
            alert("Unexpected number of coins, please remove a coin or cancel.");
            return;
        }
        // remove coin from modal
        for (let coin of globalCoinList) {
            let checkBox = document.getElementById(`follow_${coin.id}`);
            if (!followedCoins.includes(coin)) {
                // uncheck toggle
                checkBox.checked = false;
                $(`#${coin.id}_modal`).remove();
            };
        };
        // add extra coin to array and modal
        followedCoins.push(extraCoin);
        addCoinToModal(extraCoin);
        // check extraCoin toggle on main view
        document.getElementById(`follow_${extraCoin.id}`).checked = true;
        // hide modal
        $("#unfollowModal").modal('hide');
        extraCoin = null;
    };

    function addCoinToModal(coin) {
        let selectedCoinHtml =
            `<div class="card" id="${coin.id}_modal" style="width: 100%;">
                <div class="card-body">
                    <div class="custom-control custom-switch">
                        <input type="checkbox" class="custom-control-input" id="follow_${coin.id}_modal" checked>
                        <label class="custom-control-label" for="follow_${coin.id}_modal"></label>
                    </div>
                    <p class="card-title">${coin.symbol} - ${coin.name}</p>
                </div>
            </div>`
        $("#unfollowModalBody").append(selectedCoinHtml);
        $(`#follow_${coin.id}_modal`).click(() => onModalToggle());
    };

    // handle click on toggle follow
    function onToggleFollow(coin) {
        let checkBox = document.getElementById(`follow_${coin.id}`);
        if (checkBox.checked == true) {
            // add up to maxFollowed coins
            if (followedCoins.length < maxFollowed) {
                followedCoins.push(coin);
                addCoinToModal(coin);
            } else {
                // too many selected coins
                checkBox.checked = false;
                extraCoin = coin;
                $("#saveModal").attr("disabled", true);
                // activate modal toggles in case user deactivates them and cancels
                // (modal cards need to be in sync with home cards)
                $("#unfollowModal").find("input").each(function () {
                    $(this).prop("checked", true)
                });
                $("#unfollowModal").modal('show');
            }
        } else {
            // remove coin from array and modal
            let index = followedCoins.indexOf(coin);
            followedCoins.splice(index, 1);
            $(`#${coin.id}_modal`).remove();
        };
    };

    // display the list of all coins
    function displaylist(coinList) {
        let coinCards = "";
        for (let coin of coinList) {
            coinCards += `
                <div class="card" id="${coin.id}">
                    <div class="card-body">
                        <div class="custom-control custom-switch">
                            <input type="checkbox" class="custom-control-input" id="follow_${coin.id}">
                            <label class="custom-control-label" for="follow_${coin.id}"></label>
                        </div>
                        <h5 class="card-title">${coin.symbol}</h5>
                        <p class="card-text">${coin.name}</p>
                        <button href="#" class="btn btn-success" id="button_${coin.id}" data-toggle="collapse" 
                        data-target="#moreInfo_${coin.id}">More Info</button>
                        <div id="moreInfo_${coin.id}" class="moreInfo collapse"></div>
                    </div>
                </div>`
        }
        $("#allCoins").empty();
        $("#allCoins").append(coinCards);

        // add events for each coin - more info and toggle
        for (let coin of coinList) {
            // more info
            $(`#button_${coin.id}`).click(() => {
                if ($(`#moreInfo_${coin.id}`).css('display') == "none") {
                    $(`#moreInfo_${coin.id}`).append(spinnerHtml);
                    onMoreInfo(`${coin.id}`);
                };
            });
            // toggle to add or remove coin from followedCoins
            $(`#follow_${coin.id}`).click(() => onToggleFollow(coin));
        };
    };

    function onMoreInfo(coinId) {
        // get coin info from cache if exists
        if (coinId in coinCache) {
            displayMoreInfo(coinCache[coinId]);
        } else {
            // otherwise make an ajax call
            $.ajax({
                method: "GET",
                url: `https://api.coingecko.com/api/v3/coins/${coinId}`,
                error: err => alert("Error: " + err.status),
                success: response => cacheAndDisplay(response)
            });
        };
    };

    function cacheAndDisplay(coin) {
        // save coin in cache
        coinCache[coin.id] = coin;
        // delete after 2 min
        setTimeout(function () {
            delete coinCache[coin.id];
        }, 120000);
        displayMoreInfo(coin);
    };

    // add the coin info to the html
    function displayMoreInfo(coin) {
        $(`#moreInfo_${coin.id}`).empty();
        let moreInfo = `
            <image class="coinImg" src="${coin.image.small}"> </image>
            Current price: <br/>
            \$${coin.market_data.current_price.usd} <br/>
            &euro;${coin.market_data.current_price.eur} <br/>
            &#8362;${coin.market_data.current_price.ils} <br/>`

        $(`#moreInfo_${coin.id}`).empty();
        $(`#moreInfo_${coin.id}`).append(moreInfo);
    };

    // handle event for the search button
    function onSearch() {
        goHome(false);
        let searchInput = $("#searchInput").val().toLowerCase();
        if (searchInput == "") {
            // clear not-found msg and show all coins
            $("#coinNotFound").empty();
            for (let coin of globalCoinList) {
                $(`#${coin.id}`).show();
            };
        } else {
            // show only matching coins, or not-found msg
            $("#allCoins").children().hide();
            let coinFound = false;
            for (let coin of globalCoinList) {
                if (coin.symbol.toLowerCase() == searchInput ||
                    coin.name.toLowerCase() == searchInput) {
                    $(`#${coin.id}`).show();
                    coinFound = true;
                };
            }
            if (!coinFound) {
                $("#coinNotFound").html(`"${$("#searchInput").val()}" was not found`);
            } else {
                $("#coinNotFound").empty();
            };
        };
    };

    function displayLiveReports() {
        let options = {
            exportEnabled: true,
            animationEnabled: true,
            title: {
                text: ""
            },
            axisX: {
                title: "Time"
            },
            axisY: {
                title: "USD",
                titleFontColor: "#4F81BC",
                lineColor: "#4F81BC",
                labelFontColor: "#4F81BC",
                tickColor: "#4F81BC",
                includeZero: false
            },
            toolTip: {
                shared: true
            },
            legend: {
                cursor: "pointer",
                itemclick: toggleDataSeries
            },
            data: graphData
        };

        // set properties for each coin
        for (let coin of followedCoins) {
            let coinObj = {
                type: "line",
                showInLegend: true,
                xValueFormatString: "DD.MM.YYYY",
                yValueFormatString: "$#,##0.######",
                name: coin.symbol,
                dataPoints: []
            };
            graphData.push(coinObj);
        };
        $("#graphContainer").CanvasJSChart(options);
        startGraph();
    };

    // show/hide each data series when clicking on legend
    function toggleDataSeries(e) {
        if (typeof (e.dataSeries.visible) === "undefined" || e.dataSeries.visible) {
            e.dataSeries.visible = false;
        } else {
            e.dataSeries.visible = true;
        };
        e.chart.render();
    };

    // activate an interval for live graph updates
    function startGraph() {
        if (followedCoins.length === 0) {
            $("#graphContainer").hide();
            $("#graphSpinner").hide();
            $("#noGraphData").show();
            return;
        };
        // create a comma separated string of followed coin symbols
        let followedSymbols = [];
        for (let coin of followedCoins) {
            followedSymbols.push(coin.symbol);
        };
        let symbolStr = followedSymbols.join();
        // get data immediately and set interval for updates
        getGraphDataPoints(symbolStr);
        graphRefresh = setInterval(() => getGraphDataPoints(symbolStr), 2000);
    };

    // request data-points for graph updates
    function getGraphDataPoints(symbolStr) {
        $.ajax({
            method: "GET",
            url: `https://min-api.cryptocompare.com/data/pricemulti?fsyms=${symbolStr}&tsyms=USD`,
            error: err => alert("Error: " + err.status),
            success: response => updateGraph(response, new Date())
        });
    };

    // add a new data point for each followed coin
    function updateGraph(response, time) {
        // if the interval was cleared after the ajax call was sent but before the resonse arrived - 
        // skip this update, this graph no longer exists
        if (graphRefresh === null) {
            return;
        }
        // followedCoins and graphData must contain the same coins in the same order
        let responseCoins = [];
        let missingCoins = [];
        for (let i = 0; i < followedCoins.length; i++) {
            let coin = followedCoins[i];
            let symbol = coin.symbol.toUpperCase();
            // if we got this symbol in the response, add a point to the corresponding series
            if (symbol in response) {
                let newValue = { x: time, y: response[symbol].USD };
                graphData[i].dataPoints.push(newValue);
            };
            // if we ever got data points for this coin, add it to the title
            if (graphData[i].dataPoints.length > 0) {
                responseCoins.push(symbol);
            } else {
                missingCoins.push(symbol);
            };
        };
        if (responseCoins.length > 0) {
            if ($("#graphContainer").css('display') == "none") {
                $("#graphContainer").show();
                $("#graphSpinner").hide();
            };
        };
        updateGraphMsgs(responseCoins, missingCoins);
        $("#graphContainer").CanvasJSChart().render();
    };

    function updateGraphMsgs(responseCoins, missingCoins) {
        if (responseCoins.length > 0) {
            $("#graphContainer").CanvasJSChart().set("title", { text: `${responseCoins.join(", ")} to USD` });
        } else {
            $("#graphContainer").CanvasJSChart().set("title", { text: `` });
        };
        if (missingCoins.length > 0) {
            $("#partialGraphData").show();
            $("#partialGraphData").html(`No data is available for ${missingCoins.join(", ")}`);
        } else {
            $("#partialGraphData").hide();
        };
        if (responseCoins.length === 0 && followedCoins.length > 0) {
            $("#graphSpinner").hide();
            $("#partialGraphData").html(`No data is available for any of the coins you selected.`);
        };
    };

    // stop interval and clear all the data from the LiveReports
    function resetGraph() {
        if (graphRefresh !== null) {
            $("#partialGraphData").hide();
            $("#graphContainer").hide();
            clearInterval(graphRefresh);
            graphRefresh = null;
            graphData = [];
        };
    };
    // ----------------------- end of function definitions -----------------------

    createPage();
    registerEvents();

    // get the list of all coins 
    $.ajax({
        method: "GET",
        url: "https://api.coingecko.com/api/v3/coins/list",
        error: err => alert("Error: " + err.status),
        success: response => {
            globalCoinList = response.slice(0, 500)
            displaylist(globalCoinList)
        }
    });

});