-- "Aperturas con mancuernas" tenía la animación de un vuelo posterior.
--
-- El emparejamiento propuso "dumbbell rear fly" y se aprobó al curar: comparte
-- casi todas las palabras con unas aperturas de pecho y en una lista de ciento
-- y pico filas pasa. Pero es un ejercicio de deltoides posterior, no de pecho,
-- así que la fila enseñaba un movimiento de otro músculo bajo el grupo Pecho —
-- exactamente lo que `media_reviewed` existe para impedir.
--
-- Se limpia la fila entera, no solo `media_reviewed`: dejar la URL puesta con
-- la revisión en false deja una animación equivocada esperando a que alguien
-- la vuelva a aprobar por error. Sin gif, la app no enseña nada, que es el
-- estado correcto hasta que aparezca una animación que sí sea.
--
-- exercises_library_media_data.sql ya no trae esa fila, así que una aplicación
-- desde cero no la vuelve a poner. Esto es para las bases que ya la tenían.

update exercises_library
   set gif_url = null,
       media_source = null,
       media_source_id = null,
       media_reviewed = false,
       updated_at = now()
 where name = 'Aperturas con mancuernas'
   and media_source_id = '8DiFDVA';
