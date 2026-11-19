# POG 2

POG 2 is a sequal to the original android game POG. POG 2 will start as a browser game and if there are enough players we will create an android and ios version. For now it should be playable on desktop as well as phone browsers.

# Gameplay

The game consists of a planet at the center of the screen with a gun rotating at constant speed around it. POGs (Asteroids of Pink, orange and green color) are falling on the planet and the player has to use the gun to defend it.

The player has only one action, tap. The gun shoots on tap.

The play area is a square with the HUD on the remaining are (top in portrait, right in landscape)

The player has the following parameters

- Gun
  - Rotation speed
  - Type of ammo
  - Count of ammo (default ammo is infinite count)
  - Number of barels (multiple barrels would be equally spaced aroud 360degrees)
- Ammp
  - Number of projectiles per shot (one after the other) higher number would increase the probability of a hit
  - Number of projectiles per shot (angular spread) a higher angular spread would increase the probablity of a hit
  - hitpoints of an ammo
  - speed of the ammo
  - reload time
- POG
  - pogs are the asteroids which are going to hit the planet
  - hitpoints (defencepoints?) (health)
  - velocity (they may be generally moving towards the planet but some of them might also miss)
  - damage which the asteroid will do to the planet (attackpoints?)
- Planet
  - Shield type
  - defence points (health)
- Shield
  - defence points
  - active time (how long will the shield be active)
- Powers
  - A power is an item which a user may acquire by shooting it (just like an asteroid) which would enhance the parameters of the gun/planet/shield etc. A power may remain active for a specified amount of time or for a specified number of usage e.g. ammos fired or a combination of multiiple such parameters) multiple powerups are queued and activated one after the other. If the powerups do not impact each other (e.g. one is a shieldpowerup and the other is a gun power up, they mey be appplied simultaneously) all queued powerups are shown in the HUD

The score of the user is the amount of time the user has survived (in seconds)

Lets build this, write any questions you have for me
