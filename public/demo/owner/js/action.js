
(function (root) {

  var console = new ViewLogger();

  var owner = new RealStore.Owner('7475ceef-4836-48a9-afe4-0bc5a88e7ebd');

  window.owner = owner;

  function connect () {
    console.log('Connecting to server...');
    return owner.connect().then(function () {
      console.log('Successfully connected. groupId:', owner.groupId);
    });
  }

  owner.on('connect_back', function () {
    console.log('Connected back. :)');
  });

  owner.on('disconnect', function () {
    console.warn('Disconnected. :(');
  });

  // window.setAttribute = function () {
  //   console.log('Setting attribute. Attribute:', arguments);
  //   owner.model.set.apply(user.model, arguments);
  // }

  // window.unsetAttribute = function () {
  //   console.log('Unsetting attribute. Attribute:', arguments);
  //   user.model.unset.apply(user.model, arguments); 
  // }

  // owner.model.on('server_change', function (changes) {
  //   console.info('Model changed by server:', changes);
  // });

  // owner.model.on('connect_back', function () {
  //   console.log('Connected back to serer. :)');
  // });

  // owner.model.on('disconnect', function () {
  //   console.warn('Disconnected from serer. :(');
  // });

  connect().then(function () {
    // setAttribute({
    //   name: 'Sundarasan',
    //   age: 25,
    // });

    // setAttribute('height', 5.8);

    // unsetAttribute('height');
    
    owner.queryUser({}, undefined).then(function (models) {
      console.log('Models:', models);
    });

    owner.queryUserCount({}).then(function (models) {
      console.log('Models:', models);
    });

  });

  document.getElementById('clear-logs').addEventListener('click', function () {
    console.clearLogs();
  });


})(window);





(function (root) {

  /**
   * Generate Random ID
   */
  var Random = {

    s4: function() {
      return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);
    },

    guid: function() {
      return (this.s4() + this.s4() + "-" + this.s4() + "-" + this.s4() + "-" + this.s4() + "-" + this.s4() + this.s4() + this.s4());
    },

  };

  var role = 'owner',
      clientId = window.localStorage.getItem('clientId');

  if(!clientId) {
    clientId = Random.guid();
    window.localStorage.setItem(role + '-clientId', clientId);
  }

  var console = new ViewLogger(),
      Client = IOReqRes.Client,
      client = new Client(),

      companyId = '7475ceef-4836-48a9-afe4-0bc5a88e7ebd';

  console.log('This is owner demo!');

  var socket = io(undefined, {query: 'role=' + role});

  client.setSocket(socket);

  client.request('put:api/register', { clientId: clientId, groupId: companyId }, function (err, modelObject) {
    if (err) {
      console.error('Failed to register model. Error:', err);
    } else {
      console.log('Successfully registed model. model:', modelObject);

      client.request('get:api/model/count', { 'age': { $gt: 20 } }, function (err, count) {
        if (err) {
          console.error('Failed to get count of models. Error:', err);
        } else {
          
          console.log('Got count:', count);

          client.request('get:api/model', { 'age': { $gt: 20 } }, function (err, models) {
            if (err) {
              console.error('Failed to add attributes to model. Error:', err);
            } else {
              console.log('Got models:', models);
            }
          });
        }
      });

    }
  });

  socket.on('change:attributes', function (data) {
    console.info('Changed:', data);
  });

  socket.on('add:attributes', function (data) {
    console.info('Added:', data);
  });

  socket.on('remove:attributes', function (data) {
    console.info('Removed:', data);
  });

  socket.on('clear:attributes', function (data) {
    console.info('Cleared:', data);
  });

  document.getElementById('clear-logs').addEventListener('click', function () {
    console.clearLogs();
  });

});