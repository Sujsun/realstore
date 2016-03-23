function runApp() {
  require('./application').run();
}

/**
 * Analyses the environment
 */
if (process.env.NODE_ENV == 'dev') {

  runApp();

} else {

  var cluster = require('cluster'),
    nCpu = require('os').cpus().length;

  if (cluster.isMaster) {

    for (var i = 0; i < nCpu; i++) {
      cluster.fork(); //starting new for every CPU
    }

    cluster.on('listening', function(worker) {
      console.log(new Date() + ' Worker ' + worker.process.pid + ' listening');
    });

    cluster.on('exit', function(diedWorker) {
      console.log(new Date() + ' Worker ' + diedWorker.process.pid + ' just crashed');
      cluster.fork(); //starting a new worker.
    });

  } else {

    //inside a forked process
    runApp();

  }

}