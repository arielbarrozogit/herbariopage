jQuery('document').ready(function($){

  var menuBtn = $('.menu-icon'),
      menu = $('.navigation ul');

  menuBtn.click(function(){
      if ( menu.hasClass('show') ){
          menu.removeClass('show');
      } else {
          menu.addClass('show');
      }
  });

  // Manejo del envío del formulario de contacto
  $('#contactoForm').on('submit', function(e) {
    e.preventDefault();

    const nombre = $('#nombre').val();
    const email = $('#email').val();
    const mensaje = $('#mensaje').val();

    fetch('/api/enviarcorreo', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ nombre, email, mensaje })
    })
      .then(res => res.json())
      .then(data => {
        alert(data.message);
      })
      .catch(error => {
        console.error('Error:', error);
        alert('Hubo un problema al enviar el mensaje.');
      });
  });

});
