var debug = require('debug')('database-executor:database-executor');
var databaseConnector = require('node-database-connectors');
var databaseExecutor = require('./ConnectorIdentifier.js');
  if (GLOBAL._connectionPools == null) {
    GLOBAL._connectionPools = {};
  }
var oldResults = {};

function prepareQuery(dbConfig, queryConfig, cb) {
  try {
    var objConnection = databaseConnector.identify(dbConfig);
    var query = objConnection.prepareQuery(queryConfig);
    cb({
      status: true,
      content: query
    });
  } catch (ex) {
    console.log('exception: ', ex);
    var e = ex;
    //e.exception=ex;
    cb({
      status: false,
      error: e
    });
  }
}

function executeRawQueryWithConnection(dbConfig, rawQuery, cb) {
  try {
    var objConnection = databaseConnector.identify(dbConfig);
    objConnection.connect(dbConfig, function(err, connection) {
      if (err != undefined) {
        console.log('connection error: ', err);
        var e = err;
        //e.exception=ex;
        cb({
          status: false,
          error: e
        });
      } else {
        var objExecutor = databaseExecutor.identify(dbConfig);
        objExecutor.executeQuery(connection, rawQuery, function(result) {
          objConnection.disconnect(connection);
          cb(result);
        });
        // //debug('connection opened');
        // connection.beginTransaction(function(err) {
        //   if (err) {
        //     debug("beginTransaction", err);
        //     cb({
        //       status: false,
        //       error: err
        //     });
        //   } else {
        //     if(rawQuery.length<=100000000){
        //       debug('query: %s', rawQuery);
        //     }
        //     else {
        //       debug('query: %s', rawQuery.substring(0,500)+"\n...\n"+rawQuery.substring(rawQuery.length-500, rawQuery.length));
        //     }
        //     connection.query(rawQuery, function(err, results) {
        //       if (err) {
        //         debug("query", err);
        //         connection.rollback(function() {
        //           var e = err;
        //           //e.exception = err;
        //           cb({
        //             status: false,
        //             error: e
        //           });
        //           connection.end();
        //         });
        //       } else {
        //         connection.commit(function(err) {
        //           if (err) {
        //             debug("commit", err);
        //             connection.rollback(function() {
        //               var e = err;
        //               //e.exception = err;
        //               cb({
        //                 status: false,
        //                 error: e
        //               });
        //               connection.end();
        //             });
        //           } else {
        //             //debug('connection closed');
        //             cb({
        //               status: true,
        //               content:results
        //             });
        //             connection.end();
        //           }
        //         });
        //       }
        //     });
        //   }
        // });
      }
    });
  } catch (ex) {
    console.log('exception: ', ex);
    var e = ex;
    //e.exception=ex;
    cb({
      status: false,
      error: e
    });
  }
}

exports.executeRawQuery = function(requestData, cb) {
  debug('dbcon req:\nrequestData: %s', JSON.stringify(requestData));
  var dbConfig = requestData.dbConfig;
  var rawQuery = requestData.query;
  var shouldCache = requestData.hasOwnProperty('shouldCache') ? requestData.shouldCache:false;
  executeRawQuery(dbConfig, rawQuery,shouldCache, cb);
}

exports.executeQuery = function(requestData, cb) {
  //debug('dbcon req:\nrequestData: %s', JSON.stringify(requestData));
  var dbConfig = requestData.dbConfig;
  var queryConfig = requestData.query;
  var shouldCache = requestData.hasOwnProperty('shouldCache') ? requestData.shouldCache:false;
  
  prepareQuery(dbConfig, queryConfig, function(data) {
//     debug('prepareQuery', data);
    if (data.status == true) {
      executeRawQuery(dbConfig, data.content,shouldCache, cb);
    } else {
      cb(data);
    }
  });
}

exports.executeQueryStream = function(requestData, onResultFunction, cb) {
  var dbConfig = requestData.dbConfig;
  var query = requestData.rawQuery;
  var objConnection = databaseConnector.identify(dbConfig);
  objConnection.connect(dbConfig, function(err, connection) {
    if (err != undefined) {
      console.log('connection error: ', err);
      var e = err;
      //e.exception=ex;
      cb({
        status: false,
        error: e
      });
    } else {
      var objExecutor = databaseExecutor.identify(dbConfig);
      objExecutor.executeQueryStream(connection, query, onResultFunction, cb);
      // var queryExecutor = connection.query(query);
      // queryExecutor
      //   .on('error', function(err) {
      //     cb({
      //       status: false,
      //       error: err
      //     });
      //     // Handle error, an 'end' event will be emitted after this as well
      //   })
      //   .on('fields', function(fields) {
      //     // the field packets for the rows to follow
      //   })
      //   .on('result', function(row) {
      //     // Pausing the connnection is useful if your processing involves I/O
      //     connection.pause();

      //     onResultFunction(row, function() {
      //       connection.resume();
      //     });
      //   })
      //   .on('end', function() {
      //     cb({
      //       status: true
      //     });

      //   });
    }
  });
}


// DS : Handle Multiple Queries with same connection similar to batch queries;

function executeRawQueryWithConnectionPool(dbConfig, rawQuery, cb) {
  try {
    var startTime = new Date();
    getConnectionFromPool(dbConfig, function(result) {
      if (result.status === false) {
        cb(result);
      } else {
        var connection = result.content;
        if (rawQuery.length <= 100000000) {
          debug('query: %s', rawQuery);
        } else {
          debug('query: %s', rawQuery.substring(0, 500) + "\n...\n" + rawQuery.substring(rawQuery.length - 500, rawQuery.length));
        }
        var queryStartTime = new Date();
        var objExecutor = databaseExecutor.identify(dbConfig);
        objExecutor.executeQuery(connection, rawQuery, function(result) {
          if (result.status == false) {
            console.log("DB Executor Error", dbConfig, rawQuery);
          }
          debug("Total Time:", (new Date().getTime() - startTime.getTime()) / 1000, "Query Time:", (new Date().getTime() - queryStartTime.getTime()) / 1000);
          cb(result);
        });
        // connection.query(rawQuery, function(err, results) {
        //   if (err) {
        //     debug("query", err);
        //     var e = err;
        //     cb({
        //       status: false,
        //       error: e
        //     });
        //   } else {
        //     cb({
        //       status: true,
        //       content: results
        //     });
        //   }
        // });
      }
    });
  } catch (ex) {
    console.log('exception: ', ex);
    var e = ex;
    //e.exception=ex;
    cb({
      status: false,
      error: e
    });
  }
}


function executeRawQuery(dbConfig, rawQuery, shouldCache, cb) {
  if (shouldCache == true && oldResults[JSON.stringify(dbConfig)] && oldResults[JSON.stringify(dbConfig)][rawQuery]) {
    debug("RETURNING from cache for query::: ",rawQuery)
    debug("**********************************************************##############################***********************")
    cb({ status: true, content: oldResults[JSON.stringify(dbConfig)][rawQuery].result })
  } else {
    if (dbConfig.hasOwnProperty('connectionLimit') && dbConfig.connectionLimit == 0) {
      debug("With New Connection");
      executeRawQueryWithConnection(dbConfig, rawQuery, function(responseData) {
        cb(responseData)
        if (shouldCache == true && responseData.status == true) {
          saveToCache(responseData.content, dbConfig, rawQuery)
        }
      });
    } else {
      debug("With Connection Pool");
      executeRawQueryWithConnectionPool(dbConfig, rawQuery, function(responseData) {
        cb(responseData)
        if (shouldCache == true && responseData.status == true) {
          saveToCache(responseData.content, dbConfig, rawQuery)
        }
      });
    }
  }
}


function getConnectionFromPool(dbConfig, cb) {
  try {
    var connectionString = (dbConfig.databaseType + '://' + dbConfig.user + ':' + dbConfig.password + '@' + dbConfig.host + ':' + dbConfig.port + '/' + dbConfig.database);
    if (GLOBAL._connectionPools.hasOwnProperty(connectionString)) {
      cb({
        status: true,
        content: GLOBAL._connectionPools[connectionString]
      });
      return;
    } else {
      var objConnection = databaseConnector.identify(dbConfig);
      objConnection.connectPool(dbConfig, function(err, pool) {
        if (err != undefined) {
          console.log('connection error: ', err);
          var e = err;
          //e.exception=ex;
          cb({
            status: false,
            error: e
          });
        } else {
          GLOBAL._connectionPools[connectionString] = pool;
          cb({
            status: true,
            content: pool
          });
        }
      });
    }
  } catch (ex) {
    console.log('exception: ', ex);
    var e = ex;
    //e.exception=ex;
    cb({
      status: false,
      error: e
    });
  }
}


function saveToCache(finalData, dbConf, queryString) {
  dbConf = JSON.stringify(dbConf);
  if (!oldResults[dbConf]) {
    oldResults[dbConf] = {};
  }
  oldResults[dbConf][queryString] = {
    result: JSON.parse(JSON.stringify(finalData))
  };
  // console.log("################################## JSON.stringify(oldResults) ###########################################")
  // console.log(JSON.stringify(oldResults))
  // console.log("################################## JSON.stringify(oldResults) ###########################################")
  
}


