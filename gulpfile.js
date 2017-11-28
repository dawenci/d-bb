var gulp = require('gulp');
var rename = require('gulp-rename');
var gutil = require('gulp-util');
var uglify = require('gulp-uglify');
var sourcemaps = require('gulp-sourcemaps');
var watchify = require('watchify'); // 一个持续监视文件的改动，并且 只重新打包必要的文件 的 browserify 打包工具。
var browserify = require('browserify');
var source = require('vinyl-source-stream');
var buffer = require('vinyl-buffer');
var babelify = require('babelify');


// JS 编译
;(function() {
  // add custom browserify options here
  var b = watchify(browserify(Object.assign({}, watchify.args, {
    cache: {}, // required for watchify
    packageCache: {}, // required for watchify
    entries: ['./index.js'],
    debug: true
  })).transform(babelify.configure({
    presets: ['es2015']
  })))

  // 在这里加入变换操作
  // 比如： b.transform(coffeeify);
  gulp.task('js', bundle) // 这样你就可以运行 `gulp js` 来编译文件了
  b.on('update', bundle) // 当任何依赖发生改变的时候，运行打包工具
  b.on('log', gutil.log) // 输出编译日志到终端

  function bundle() {
    return b.bundle()
      // 如果有错误发生，记录这些错误
      .on('error', gutil.log.bind(gutil, 'Browserify Error'))
      .pipe(source('dbb.js'))
      // optional, remove if you don't need to buffer file contents
      .pipe(buffer())
      .pipe(gulp.dest('./build/'))
      // 可选项，如果你不需要 sourcemaps，就删除
      // .pipe(sourcemaps.init({loadMaps: true})) // 从 browserify 文件载入 map
      // 在这里将变换操作加入管道
      .pipe(uglify())
      .on('error', gutil.log)
      .pipe(rename({
          basename: "dbb",
          suffix: "-min",
          extname: ".js"
      }))
      .pipe(gulp.dest('./build/'))
      .pipe(sourcemaps.write('./')) // 写入 .map 文件
      .pipe(gulp.dest('./build/'))
  }
})()


gulp.task('default', ['js'])