// Published under the BSD License by Jason Gauci (jgmath2000@gmail.com)

/*
 * GET home page.
 */

/**
 * Description
 * @method index
 * @param {} req
 * @param {} res
 * @return 
 */
exports.index = function(req, res) {
  res.render('index', {
    title: 'Express'
  });
};
