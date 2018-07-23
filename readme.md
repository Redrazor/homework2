**Controllers**

    /users

This controller is  CRUD that manages user creation, update, read and delete

    /tokens
This controller manages the generation of tokens to allow for control management access

    /carts
This controller manages cart management. it focus on adding and deleting items to/from the cart, requesting the users current cart and initiating the checkout process.
Note: The checkout will manage both the stripe payment as well as the receipt sending through mailgun.

    /items
This Controller manages adding/removing/editing and listing the items on the menu. Only listing the menu can be accessed by a normal user. The other operations are limited to users flaged with the "isAdmin" property.
