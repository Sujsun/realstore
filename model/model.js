var mongoose = require('mongoose'),
    timestampPlugin = require('mongoose-timestamp'),
    _ = require('underscore'),
    ObjectUtils = require('../utils/object'),
    Model = require('../utils/model'),
    ModelModel,
    collectionName = 'Model';

var ModelSchema = new mongoose.Schema({
  clientId: { type: String, unique: true },
  groupId: { type: String },
  attributes: { type:mongoose.Schema.Types.Mixed },
});

ModelSchema.plugin(timestampPlugin);

ModelModel = mongoose.model(collectionName, ModelSchema);

function save (modelModelParam) {
  return new Promise(function (resolve, reject) {
    modelModelParam.save(function (err, modelModel) {
      if (err) {
        /**
         * If concurrency duplicate record, then returning the existing record
         */
        if(err.code === 11000) {
          ModelModel.getModel(modelModelParam.get('clientId')).then(function (modelModel) {
            console.log('Stopped creating duplicate model. Just reading the existing model and returning.');
            resolve(modelModel)
          }).catch(function (err) {
            reject(err);
          });
        } else {
          reject(err);
        }
      } else {
        resolve(modelModel);
      }
    });
  });
}

function findChanges (oldAttributes, newAttributes) {
  var index,
      change,
      changes = ObjectUtils.findChanges(oldAttributes, newAttributes),
      changesLength = changes.length,
      addedAttributes = {},
      removedAttributes = [],
      changedAttributes = {};

  for (index = 0; index < changesLength; index++) {
    change = changes[index];
    switch (change.action) {
      case 'add':
        addedAttributes[change.attributeName] = change.newValue;
        break;
      case 'remove':
        removedAttributes.push(change.attributeName);
        break;
      case 'change':
        changedAttributes[change.attributeName] = change.newValue;
        break;
    }
  }

  return {
    addedAttributes: addedAttributes,
    removedAttributes: removedAttributes,
    changedAttributes: changedAttributes,
  };
}

ModelModel.upsert = function (modelObject) {
  return new Promise(function (resolve, reject) {

    ModelModel.findOne({
      clientId: modelObject.clientId
    }).exec(function (err, modelModel) {
      if (err) {
        reject(err);
      } else {
        var savePromise;
        if (!modelModel) {
          modelModel = new ModelModel(modelObject);
        }
        save(modelModel, resolve, reject).then(function (modelModel) {
          resolve(modelModel);
        }).catch(function (err) {
          reject(err);
        });
      }
    });

  });
};

ModelModel.getModel = function (clientId) {
  return new Promise(function (resolve, reject) {
    ModelModel.findOne({
      clientId: clientId,
    }).exec(function (err, modelModel) {
      if (err) {
        reject(err);
      } else {
        if (!modelModel) {
          reject(new Error('Model not found to add attributes'));
        } else {
          resolve(modelModel);
        }
      }
    });
  });
};

ModelModel.addAttributes = function (clientId, attributesToAdd) {
  return new Promise(function (resolve, reject) {
    ModelModel.findOne({
      clientId: clientId,
    }).exec(function (err, modelModel) {
      if (err) {
        reject(err);
      } else {
        if (!modelModel) {
          reject(new Error('Model not found to add attributes'));
        } else {
          var key,
              oldAttributes = modelModel.toObject().attributes || {},
              modifiedAttributes = _.extend({}, oldAttributes);

          for (key in attributesToAdd) {
            modifiedAttributes[key] = attributesToAdd[key];
          }

          modelModel.set('attributes', modifiedAttributes);

          save(modelModel).then(function (modelModel) {
            var newAttributes = modelModel.toObject().attributes || {},
                changes = findChanges(oldAttributes, newAttributes);

            resolve({
              model: modelModel,
              changes: changes
            });
          }).catch(function (err) {
            reject(err);
          });
        }
      }
    });
  });
};

ModelModel.removeAttributes = function (clientId, attributesToRemove) {
  return new Promise(function (resolve, reject) {
    ModelModel.findOne({
      clientId: clientId,
    }).exec(function (err, modelModel) {
      if (err) {
        reject(err);
      } else {
        if (!modelModel) {
          reject(new Error('Model not found to remove attributes'));
        } else {
          var index,
              oldAttributes = modelModel.toObject().attributes || {},
              modifiedAttributes = _.extend({}, oldAttributes);

          if (typeof(modifiedAttributes) === 'object') {
            typeof(attributesToRemove) === 'string' && (attributesToRemove = [attributesToRemove]);
            for (index in attributesToRemove) {
              delete modifiedAttributes[attributesToRemove[index]];
            }

            modelModel.set('attributes', modifiedAttributes);

            save(modelModel).then(function (modelModel) {
              var newAttributes = modelModel.toObject().attributes || {},
                changes = findChanges(oldAttributes, newAttributes);

              resolve({
                model: modelModel,
                changes: changes
              });
            }).catch(function (err) {
              reject(err)
            });
          } else {
            resolve(modelModel);
          }
        }
      }
    });
  });
};

ModelModel.clearAttributes = function (clientId) {
  return new Promise(function (resolve, reject) {
    ModelModel.findOne({
      clientId: clientId,
    }).exec(function (err, modelModel) {
      if (err) {
        reject(err);
      } else {
        modelModel.unset('attributes', attributes);
        save(modelModel).then(function (modelModel) {
          resolve(modelModel);
        }).catch(function (err) {
          reject(err);
        });
      }
    });
  });
};

ModelModel.getModelsByGroupId = function (groupId, attributesQuery) {
  return new Promise(function (resolve, reject) {
    if (!groupId) {
      reject(new Error('groupId is missing'));
    } else {
      var query = {};
      query.groupId = groupId;
      
      for (var key in attributesQuery) {
        query['attributes.' + key] = attributesQuery[key];
      }

      ModelModel.find(query).exec(function (err, modelsArray) {
        if (err) {
          reject(err);
        } else {
          resolve(modelsArray);
        }
      });
    }
  });
};

ModelModel.drop = function () {
  return new Promise(function (resolve, reject) {
    var collection = mongoose.connection.collections[collectionName.toLowerCase() + 's'];
    if (!collection) {
      resolve();
    } else {
      collection.drop( function(err) {
        if (!err) {
          reject(err);
        } else {
          resolve();
        }
      });
    }
  });
};

module.exports = {
  Model: ModelModel,
};