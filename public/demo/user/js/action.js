(function (root) {

  var console = new ViewLogger();

  var user = new RealStore.User('7475ceef-4836-48a9-afe4-0bc5a88e7ebd');

  window.user = user;

  function connect () {
    console.log('Connecting to server...');
    return user.connect().then(function () {
      console.log('Successfully connected. clientId:', user.getClientId());
    });
  }

  window.setAttribute = function () {
    console.log('Setting attribute. Attribute:', arguments);
    user.model.set.apply(user.model, arguments);
  }

  window.unsetAttribute = function () {
    console.log('Unsetting attribute. Attribute:', arguments);
    user.model.unset.apply(user.model, arguments); 
  }

  user.model.on('server_change', function (changes) {
    console.info('Model changed by server:', changes);
  });

  user.model.on('connect_back', function () {
    console.log('Connected back to serer. :)');
  });

  user.model.on('disconnect', function () {
    console.warn('Disconnected from serer. :(');
  });

  user.model.on('custom_message', function (dataObject) {
    console.info('Received custom message:', dataObject);
  });

  connect().then(function () {
    setAttribute({
      name: 'Sundarasan',
      age: 25,
    });

    setAttribute('height', 5.8);

    unsetAttribute('height');

  });

  document.getElementById('clear-logs').addEventListener('click', function () {
    console.clearLogs();
  });

})(window);