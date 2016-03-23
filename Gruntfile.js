
function getPluginBanner () {
  var pluginBanner = '';
  pluginBanner += '/**\n';
  pluginBanner += ' * Name: RealStore Client SDK\n';
  pluginBanner += ' * Author: Sundarasan Natarajan\n';
  pluginBanner += ' * Date: ' + new Date().toUTCString() + '\n';
  pluginBanner += ' * Version: 0.0.1\n';
  pluginBanner += ' */\n';
  return pluginBanner;  
}

var pluginBanner = getPluginBanner();

module.exports = function(grunt) {
  grunt.initConfig({

    watchify: {
      options: {
        debug: true,
        banner: pluginBanner,
      },
      user: {
        src: ['./public/js/sdk/raw/user/index.js'],
        dest: 'public/js/sdk/dist/user.js'
      },
      owner: {
        src: ['./public/js/sdk/raw/owner/index.js'],
        dest: 'public/js/sdk/dist/owner.js'
      },
    },

    uglify: {
      dist: {
        options: {
          banner: pluginBanner
        },
        files: {
          'public/js/sdk/dist/owner.min.js': ['public/js/sdk/dist/owner.js'],
          'public/js/sdk/dist/user.min.js': ['public/js/sdk/dist/user.js'],
        }
      }
    },

  });

  grunt.loadNpmTasks('grunt-watchify');
  grunt.loadNpmTasks('grunt-contrib-uglify');

  grunt.registerTask('build', [
    'watchify',
    'uglify',
  ]);

  grunt.registerTask('default', [
    'build',
  ]);
};