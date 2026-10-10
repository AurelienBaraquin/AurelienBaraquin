//! Applique une commande de jeu a une pose de camera avec le vrai moteur
//! raycaster (collisions et portes comprises), rend l'image en PPM et ecrit la
//! nouvelle pose en JSON sur la sortie standard.
//!
//! Usage : `walker <x> <y> <angle_degres> <forward|back|left|right|none> <sortie.ppm>`

use glam::Vec2;
use raycaster_core::{Camera, Input, World, demo_level};
use std::io::Write;
use std::process::ExitCode;

const WIDTH: usize = 640;
const HEIGHT: usize = 480;
const TICK_SECONDS: f32 = 0.2;
/// Les portes s'animent selon la proximite du joueur et ne sont pas persistees
/// entre deux executions : on laisse le monde se stabiliser (5 s simulees).
const SETTLE_TICKS: u32 = 25;

#[derive(Debug, Clone, Copy, PartialEq)]
enum Command {
    Forward,
    Back,
    Left,
    Right,
    None,
}

impl Command {
    fn parse(text: &str) -> Result<Self, String> {
        match text {
            "forward" => Ok(Self::Forward),
            "back" => Ok(Self::Back),
            "left" => Ok(Self::Left),
            "right" => Ok(Self::Right),
            "none" => Ok(Self::None),
            other => Err(format!("commande inconnue : {other}")),
        }
    }

    /// Un seul pas de `TICK_SECONDS`. Tourner a gauche est un angle positif.
    fn input(self) -> Input {
        match self {
            Self::Forward => Input {
                forward: 1.0,
                strafe: 0.0,
                turn: 0.0,
            },
            Self::Back => Input {
                forward: -1.0,
                strafe: 0.0,
                turn: 0.0,
            },
            Self::Left => Input {
                forward: 0.0,
                strafe: 0.0,
                turn: 1.0,
            },
            Self::Right => Input {
                forward: 0.0,
                strafe: 0.0,
                turn: -1.0,
            },
            Self::None => Input {
                forward: 0.0,
                strafe: 0.0,
                turn: 0.0,
            },
        }
    }
}

#[derive(Debug, PartialEq)]
struct Pose {
    x: f32,
    y: f32,
    angle_degrees: f32,
}

fn settle(world: &mut World) {
    let still = Command::None.input();
    for _ in 0..SETTLE_TICKS {
        world.update(still, TICK_SECONDS);
    }
}

fn step(pose: &Pose, command: Command) -> (World, Pose) {
    let camera = Camera {
        position: Vec2::new(pose.x, pose.y),
        dir: Vec2::from_angle(pose.angle_degrees.to_radians()),
        eye_height: 1.0,
        fov: 66f32.to_radians(),
    };
    let mut world = World::new(demo_level(), camera);

    settle(&mut world);
    if command != Command::None {
        world.update(command.input(), TICK_SECONDS);
    }
    settle(&mut world);

    let moved = world.camera();
    let next = Pose {
        x: moved.position.x,
        y: moved.position.y,
        angle_degrees: moved
            .dir
            .y
            .atan2(moved.dir.x)
            .to_degrees()
            .rem_euclid(360.0),
    };
    (world, next)
}

fn write_ppm(world: &World, path: &str) -> Result<(), String> {
    let mut framebuffer = vec![0u32; WIDTH * HEIGHT];
    world.render(&mut framebuffer, WIDTH, HEIGHT);

    let file = std::fs::File::create(path)
        .map_err(|error| format!("creation de {path} impossible : {error}"))?;
    let mut out = std::io::BufWriter::new(file);
    write!(out, "P6\n{WIDTH} {HEIGHT}\n255\n").map_err(|error| error.to_string())?;
    for &pixel in &framebuffer {
        let bytes = [
            ((pixel >> 16) & 0xFF) as u8,
            ((pixel >> 8) & 0xFF) as u8,
            (pixel & 0xFF) as u8,
        ];
        out.write_all(&bytes).map_err(|error| error.to_string())?;
    }
    out.flush().map_err(|error| error.to_string())
}

fn parse_number(text: &str, name: &str) -> Result<f32, String> {
    let value: f32 = text
        .parse()
        .map_err(|_| format!("{name} invalide : {text}"))?;
    if value.is_finite() {
        Ok(value)
    } else {
        Err(format!("{name} doit etre fini"))
    }
}

fn run(args: &[String]) -> Result<Pose, String> {
    let [x, y, angle, command, output] = args else {
        return Err("usage: walker <x> <y> <angle_degres> <commande> <sortie.ppm>".to_string());
    };
    let pose = Pose {
        x: parse_number(x, "x")?,
        y: parse_number(y, "y")?,
        angle_degrees: parse_number(angle, "angle")?,
    };
    let (world, next) = step(&pose, Command::parse(command)?);
    write_ppm(&world, output)?;
    Ok(next)
}

fn main() -> ExitCode {
    let args: Vec<String> = std::env::args().skip(1).collect();
    match run(&args) {
        Ok(pose) => {
            println!(
                "{{\"x\":{},\"y\":{},\"angle\":{}}}",
                pose.x, pose.y, pose.angle_degrees
            );
            ExitCode::SUCCESS
        }
        Err(message) => {
            eprintln!("{message}");
            ExitCode::from(2)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn pose(x: f32, y: f32, angle_degrees: f32) -> Pose {
        Pose {
            x,
            y,
            angle_degrees,
        }
    }

    #[test]
    fn forward_advances_one_step_along_the_heading() {
        let (_, next) = step(&pose(5.0, 4.0, 0.0), Command::Forward);

        assert!((next.x - 5.6).abs() < 1e-4, "x = {}", next.x);
        assert!((next.y - 4.0).abs() < 1e-4);
    }

    #[test]
    fn a_wall_stops_the_player() {
        let (_, next) = step(&pose(0.3, 4.0, 180.0), Command::Forward);

        assert!((next.x - 0.3).abs() < 1e-4, "x = {}", next.x);
    }

    #[test]
    fn turning_left_increases_the_angle_and_right_decreases_it() {
        let (_, left) = step(&pose(5.0, 4.0, 90.0), Command::Left);
        let (_, right) = step(&pose(5.0, 4.0, 90.0), Command::Right);

        assert!(left.angle_degrees > 90.0 && left.angle_degrees < 180.0);
        assert!(right.angle_degrees < 90.0 && right.angle_degrees > 0.0);
    }

    #[test]
    fn the_angle_is_normalised_to_a_full_turn() {
        let (_, next) = step(&pose(5.0, 4.0, 1.0), Command::Right);

        assert!(
            (0.0..360.0).contains(&next.angle_degrees),
            "angle = {}",
            next.angle_degrees
        );
    }

    #[test]
    fn the_door_opens_when_the_player_stands_beside_it() {
        // La porte est en x ~ 10.0..10.3 : depuis la salle, face a l'est,
        // le joueur doit pouvoir la franchir une fois ouverte.
        let (_, next) = step(&pose(9.4, 4.0, 0.0), Command::Forward);

        assert!(next.x > 9.9, "x = {}", next.x);
    }

    #[test]
    fn none_leaves_the_pose_unchanged() {
        let (_, next) = step(&pose(5.0, 4.0, 45.0), Command::None);

        assert!((next.x - 5.0).abs() < 1e-4 && (next.y - 4.0).abs() < 1e-4);
        assert!((next.angle_degrees - 45.0).abs() < 1e-3);
    }

    #[test]
    fn invalid_arguments_are_rejected_without_panicking() {
        assert!(
            run(&[
                "a".into(),
                "1".into(),
                "0".into(),
                "none".into(),
                "x.ppm".into()
            ])
            .is_err()
        );
        assert!(
            run(&[
                "1".into(),
                "1".into(),
                "0".into(),
                "dance".into(),
                "x.ppm".into()
            ])
            .is_err()
        );
        assert!(
            run(&[
                "NaN".into(),
                "1".into(),
                "0".into(),
                "none".into(),
                "x.ppm".into()
            ])
            .is_err()
        );
        assert!(run(&[]).is_err());
    }
}
