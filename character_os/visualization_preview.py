"""Generate a minimal 2D SVG preview for Character Physics.

This preview intentionally uses only the Python standard library. The first
view projects personality space onto two axes:

x = trust
y = fear
"""

from __future__ import annotations

from pathlib import Path

from personality.space import big_five_from_coordinate, lin_fan_initial_coordinate
from physics_engine import CharacterPhysicsState, ExperienceEvent
from simulation.runner import run_event_sequence


OUTPUT_PATH = Path(__file__).resolve().parents[1] / "outputs" / "personality_space_preview.svg"


def main() -> None:
    """Run a short simulation and render a 2D personality-space preview."""

    coordinate = lin_fan_initial_coordinate()
    state = CharacterPhysicsState(
        coordinate=coordinate,
        personality=big_five_from_coordinate(coordinate),
        learning_rate=0.03,
    )
    events = [
        ExperienceEvent(
            id="abandonment_1",
            description="王雪三天没有回复消息。",
            tags=["王雪", "失联", "等待", "亲密关系"],
            intensity=0.75,
            importance=0.8,
            relationship_weight=0.9,
            expectation_gap=0.8,
            personality_sensitivity=0.9,
        ),
        ExperienceEvent(
            id="abandonment_2",
            description="王雪答应见面后临时消失。",
            tags=["王雪", "失联", "等待", "亲密关系"],
            intensity=0.7,
            importance=0.75,
            relationship_weight=0.9,
            expectation_gap=0.85,
            personality_sensitivity=0.9,
        ),
        ExperienceEvent(
            id="abandonment_3",
            description="林凡再次在深夜等待王雪的解释。",
            tags=["王雪", "等待", "被抛弃", "夜晚"],
            intensity=0.78,
            importance=0.82,
            relationship_weight=0.95,
            expectation_gap=0.82,
            personality_sensitivity=0.9,
        ),
    ]

    result = run_event_sequence(state, events)
    svg = render_svg(
        initial_coordinate=coordinate.to_dict(),
        snapshots=[snapshot.coordinate for snapshot in result.snapshots],
        cluster=result.final_state.clusters["abandonment"],
    )
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(svg, encoding="utf-8")
    print(f"Preview written to: {OUTPUT_PATH}")


def render_svg(
    initial_coordinate: dict[str, float],
    snapshots: list[dict[str, float]],
    cluster,
) -> str:
    """Render a trust/fear projection as SVG."""

    width = 920
    height = 640
    margin = 80
    plot_width = width - margin * 2
    plot_height = height - margin * 2

    def point(coordinate: dict[str, float]) -> tuple[float, float]:
        x = margin + coordinate["trust"] * plot_width
        y = margin + (1 - coordinate["fear"]) * plot_height
        return x, y

    initial = point(initial_coordinate)
    trajectory = [point(item) for item in snapshots]
    final = trajectory[-1]
    cluster_center = {
        "trust": max(0.0, min(1.0, 0.5 + cluster.center_coordinate.get("trust"))),
        "fear": max(0.0, min(1.0, 0.5 + cluster.center_coordinate.get("fear"))),
    }
    cluster_point = point(cluster_center)
    cluster_radius = 24 + cluster.mass * 16

    trajectory_lines = []
    previous = initial
    for current in trajectory:
        trajectory_lines.append(
            f'<line x1="{previous[0]:.1f}" y1="{previous[1]:.1f}" '
            f'x2="{current[0]:.1f}" y2="{current[1]:.1f}" '
            'stroke="#334155" stroke-width="2.5" marker-end="url(#arrow)" />'
        )
        previous = current

    memory_nodes = []
    for index, current in enumerate(trajectory, start=1):
        memory_nodes.append(
            f'<circle cx="{current[0]:.1f}" cy="{current[1]:.1f}" r="7" '
            'fill="#f97316" stroke="#9a3412" stroke-width="2" />'
        )
        memory_nodes.append(
            f'<text x="{current[0] + 10:.1f}" y="{current[1] - 10:.1f}" '
            'class="small">Memory '
            f"{index}</text>"
        )

    return f"""<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">
  <defs>
    <marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="strokeWidth">
      <path d="M0,0 L0,6 L9,3 z" fill="#334155" />
    </marker>
    <style>
      .title {{ font: 700 24px Arial, sans-serif; fill: #0f172a; }}
      .label {{ font: 600 14px Arial, sans-serif; fill: #334155; }}
      .small {{ font: 12px Arial, sans-serif; fill: #475569; }}
      .axis {{ stroke: #94a3b8; stroke-width: 2; }}
      .grid {{ stroke: #e2e8f0; stroke-width: 1; }}
    </style>
  </defs>
  <rect width="100%" height="100%" fill="#f8fafc" />
  <text x="40" y="44" class="title">Character Physics Preview: Lin Fan</text>
  <text x="40" y="68" class="small">2D projection: x = trust, y = fear. Repeated abandonment-like events pull the personality core.</text>

  <line x1="{margin}" y1="{height - margin}" x2="{width - margin}" y2="{height - margin}" class="axis" />
  <line x1="{margin}" y1="{height - margin}" x2="{margin}" y2="{margin}" class="axis" />
  <text x="{width / 2 - 40:.1f}" y="{height - 28}" class="label">trust →</text>
  <text x="24" y="{height / 2:.1f}" class="label" transform="rotate(-90 24,{height / 2:.1f})">fear →</text>

  <line x1="{margin}" y1="{margin}" x2="{width - margin}" y2="{margin}" class="grid" />
  <line x1="{width - margin}" y1="{margin}" x2="{width - margin}" y2="{height - margin}" class="grid" />
  <text x="{margin - 10}" y="{height - margin + 24}" class="small">0</text>
  <text x="{width - margin - 8}" y="{height - margin + 24}" class="small">1</text>
  <text x="{margin - 28}" y="{margin + 4}" class="small">1</text>

  <circle cx="{cluster_point[0]:.1f}" cy="{cluster_point[1]:.1f}" r="{cluster_radius:.1f}" fill="#fee2e2" stroke="#dc2626" stroke-width="3" opacity="0.75" />
  <text x="{cluster_point[0] + cluster_radius + 8:.1f}" y="{cluster_point[1]:.1f}" class="label">abandonment cluster</text>
  <text x="{cluster_point[0] + cluster_radius + 8:.1f}" y="{cluster_point[1] + 18:.1f}" class="small">mass={cluster.mass}, stability={cluster.stability}, age={cluster.age}</text>

  <circle cx="{initial[0]:.1f}" cy="{initial[1]:.1f}" r="10" fill="#2563eb" stroke="#1e3a8a" stroke-width="3" />
  <text x="{initial[0] + 14:.1f}" y="{initial[1] + 5:.1f}" class="label">initial personality core</text>

  {''.join(trajectory_lines)}
  {''.join(memory_nodes)}

  <circle cx="{final[0]:.1f}" cy="{final[1]:.1f}" r="11" fill="#16a34a" stroke="#166534" stroke-width="3" />
  <text x="{final[0] + 14:.1f}" y="{final[1] + 5:.1f}" class="label">after repeated events</text>

  <rect x="620" y="440" width="240" height="120" rx="8" fill="#ffffff" stroke="#cbd5e1" />
  <text x="638" y="466" class="label">Legend</text>
  <circle cx="646" cy="490" r="7" fill="#2563eb" /><text x="664" y="494" class="small">initial core</text>
  <circle cx="646" cy="514" r="7" fill="#f97316" /><text x="664" y="518" class="small">memory node</text>
  <circle cx="646" cy="538" r="7" fill="#16a34a" /><text x="664" y="542" class="small">final core</text>
</svg>
"""


if __name__ == "__main__":
    main()
