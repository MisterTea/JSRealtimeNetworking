var g = require("./globals.js");

module.exports = {
  pointInRect: function(point, rect) {
    return point.x >= rect.x &&
      point.y >= rect.y &&
      point.x < (rect.x + rect.width) &&
      point.y < (rect.y + rect.height);
  },
  translatePoint: function(point, direction) {
    switch (direction) {
      case g.UP:
        point.y--;
        break;
      case g.RIGHT:
        point.x++;
        break;
      case g.DOWN:
        point.y++;
        break;
      case g.LEFT:
        point.x--;
        break;
      default:
        console.trace();
        throw "OOPS";
    }
    return point;
  },
  manhatDistance: function(p1, p2) {
    return Math.abs(p1.x - p2.x) + Math.abs(p1.y - p2.y);
  },
  playerTrailsIntersect: function(player, players) {
    var futurePoint = this.translatePoint({
      x: player.x,
      y: player.y
    }, player.direction);
    return this.playerTrailsIntersectWithFuturePoint(player, players, futurePoint);
  },
  playerTrailsIntersectWithFuturePoint: function(player, players, futurePoint) {
    for (var playerName in players) {
      var trails = players[playerName].trails;
      for (var i = 0; i < trails.length - 1; i++) {
        var p1 = trails[i];
        var p2 = trails[i + 1];
        var d = [p2.x - p1.x, p2.y - p1.y];
        if (d.x == 0 && d.y == 0) {
          continue;
        }
        var isect = this.intersectOrtho(
          player.x, player.y, futurePoint.x, futurePoint.y,
          p1.x, p1.y, p2.x, p2.y);
        if (isect) {
          return playerName;
        }
      }
    }
    return null;
  },
  intersectOrtho: function(l1x1, l1y1, l1x2, l1y2,
    l2x1, l2y1, l2x2, l2y2) {
    if (l1x1 != l1x2 && l1y1 != l1y2) {
      assert("Line 1 is not othonormal");
    }
    if (l2x1 != l2x2 && l2y1 != l2y2) {
      assert("Line 3 is not othonormal");
    }

    if (l1y1 == l1y2) {
      if (l1x2 < l1x1) {
        // Swap
        var temp = l1x1;
        l1x1 = l1x2;
        l1x2 = temp;
      }
    } else {
      if (l1y2 < l1y1) {
        // Swap
        var temp = l1y1;
        l1y1 = l1y2;
        l1y2 = temp;
      }
    }
    if (l2y1 == l2y2) {
      if (l2x2 < l2x1) {
        // Swap
        var temp = l2x1;
        l2x1 = l2x2;
        l2x2 = temp;
      }
    } else {
      if (l2y2 < l2y1) {
        // Swap
        var temp = l2y1;
        l2y1 = l2y2;
        l2y2 = temp;
      }
    }


    if (l1y1 == l1y2 && l2y1 == l2y2) {
      // both lines are horizontal
      if (l1y1 != l2y1) {
        return false;
      }

      if ((l2x1 >= l1x1 && l2x1 <= l1x2) ||
        (l2x2 >= l1x1 && l2x2 <= l1x2)) {
        return true;
      } else {
        return false;
      }
    }

    if (l1x1 == l1x2 && l2x1 == l2x2) {
      // both lines are vertical
      if (l1x1 != l2x1) {
        return false;
      }

      if ((l2y1 >= l1y1 && l2y1 <= l1y2) ||
        (l2y2 >= l1y1 && l2y2 <= l1y2)) {
        return true;
      } else {
        return false;
      }
    }

    // Check if the lines cross
    if (l1y1 == l1y2) {
      // The first line is horizontal and the second is veritcal.

      // Check that the x of the second line is between the endpoints of
      // the first.
      if (l2x1 < l1x1 || l2x1 > l1x2) {
        return false;
      }

      // Check that the y of the first line is between the endpoints of
      // the second.
      if (l1y1 < l2y1 || l1y1 > l2y2) {
        return false;
      }

      return true;
    } else {
      // The first line is vertical and the second is horizontal.

      // Check that the y of the second line is between the endpoints of
      // the first.
      if (l2y1 < l1y1 || l2y1 > l1y2) {
        return false;
      }

      // Check that the x of the first line is between the endpoints of
      // the second.
      if (l1x1 < l2x1 || l1x1 > l2x2) {
        return false;
      }

      return true;
    }
  }

};
