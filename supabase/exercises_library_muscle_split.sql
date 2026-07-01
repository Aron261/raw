-- Curación de grupos musculares en la librería: split de "Pierna" en
-- Cuádriceps / Hamstrings / Glúteo / Gemelos (aplicado en producción por id).
-- Los ejercicios propios de cada usuario (tabla exercises) se curan aparte,
-- ya que son datos por-usuario, no parte del seed.

update exercises_library set muscle_group = 'Cuádriceps' where name in (
  'Aducción en máquina',
  'Extensión de cuádriceps en máquina',
  'Extensión de cuádriceps unilateral',
  'Hack squat en máquina',
  'Prensa de pierna',
  'Prensa de pierna unilateral',
  'Sentadilla con barra',
  'Sentadilla en Smith',
  'Sentadilla frontal',
  'Sentadilla goblet',
  'Sentadilla hack con barra',
  'Sissy squat',
  'Zancada con barra',
  'Zancada con mancuernas'
);

update exercises_library set muscle_group = 'Hamstrings' where name in (
  'Curl femoral de pie',
  'Curl femoral sentado',
  'Curl femoral tumbado',
  'Nordic curl',
  'Peso muerto piernas rígidas',
  'Peso muerto rumano'
);

update exercises_library set muscle_group = 'Glúteo' where name in (
  'Abducción en máquina',
  'Glute bridge',
  'Hip thrust con barra',
  'Hip thrust en máquina',
  'Patada de glúteo en polea',
  'Zancada búlgara',
  'Zancada inversa',
  'Step-up con mancuernas'
);

update exercises_library set muscle_group = 'Gemelos' where name in (
  'Elevación de talones de pie',
  'Elevación de talones en prensa',
  'Elevación de talones sentado'
);
