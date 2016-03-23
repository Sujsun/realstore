
(function (root) {

  var console = new ViewLogger();

  var owner = new RealStore.Owner('7475ceef-4836-48a9-afe4-0bc5a88e7ebd', {
    clientId: 's.n.sundarasan@gmail.com',
  });

  window.owner = owner;

  function connect () {
    console.log('Connecting to server...');
    return owner.connect().then(function () {
      console.log('Successfully connected.   clientId:', owner.clientId, '   groupId:', owner.groupId);
    });
  }

  owner.on('connect_back', function () {
    console.log('Connected back. :)');
  });

  owner.on('disconnect', function () {
    console.warn('Disconnected. :(');
  });

  
  connect().then(function () {
    
    owner.queryUser({}, undefined).then(function (models) {
      var model;
      console.log('Models:', models);
      window.models = models;
      if (models.length > 0) {
        model = models[0];
        window.model = model;
        model.on('change', function () {
          console.info('User model changed:', model.toJSON());
        });

        model.on('custom_message', function (message) {
          console.info('User model received custom message:', message);
        });
      }
    });

    owner.on('custom_message', function (userModel, message) {
      console.info('A model received custom message:', userModel, message);
    });

    owner.queryUserCount({}).then(function (models) {
      console.log('Model count:', models);
    });

  });

  document.getElementById('clear-logs').addEventListener('click', function () {
    console.clearLogs();
  });


})(window);