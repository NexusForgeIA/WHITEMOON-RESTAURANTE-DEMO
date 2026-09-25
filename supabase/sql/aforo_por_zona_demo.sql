-- Aforo por zona · sede demo `demo-restaurante` (Majadahonda)
-- NO aplicado. Orden: 1) desplegar reservas-mt con aforo por zona y el front,
-- 2) ejecutar este UPDATE. Al revés, la v7 ignora el aforo y el front antiguo
-- pintaría "[object Object]" en los chips de zona.
--
-- Mismos topes en comida y cena: la config de zonas no distingue turno. El tope
-- del turno (comida 40 / cena 45) sigue mandando por encima.

update reservas_config
set zonas = '[{"nombre":"Interior","aforo":24},{"nombre":"Terraza","aforo":12},{"nombre":"Barra","aforo":8}]'::jsonb,
    updated_at = now()
where tenant = 'demo-restaurante';

-- Comprobación
select tenant, zonas from reservas_config where tenant = 'demo-restaurante';

-- Vuelta atrás (formato de texto de hoy: sin aforo por zona)
-- update reservas_config
-- set zonas = '["Interior","Terraza","Barra"]'::jsonb, updated_at = now()
-- where tenant = 'demo-restaurante';
