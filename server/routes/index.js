// Published under the BSD License by Jason Gauci (jgmath2000@gmail.com)

/*
 * GET home page.
 */

exports.index = function(req, res) {
  res.render('index', {
    title: 'Express'
  });
};
