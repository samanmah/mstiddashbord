package ir.ppm.mpp;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.mpxj.Duration;
import org.mpxj.ProjectFile;
import org.mpxj.ProjectProperties;
import org.mpxj.Relation;
import org.mpxj.RelationType;
import org.mpxj.Resource;
import org.mpxj.ResourceAssignment;
import org.mpxj.Task;
import org.mpxj.TimeUnit;
import org.mpxj.reader.UniversalProjectReader;

/**
 * CLI: java -jar mpxj-helper.jar --file &lt;path&gt; --format json
 * Output matches packages/contracts MppParseResult.
 * MPXJ 16.5.0 package namespace is org.mpxj (pinned in pom.xml).
 */
public final class MpxjHelper {
  private static final String PARSER_VERSION = "mpxj-adapter-1.0.0";
  private static final DateTimeFormatter ISO = DateTimeFormatter.ISO_OFFSET_DATE_TIME;

  private MpxjHelper() {}

  public static void main(String[] args) {
    String file = null;
    String format = "json";
    for (int i = 0; i < args.length; i++) {
      if ("--file".equals(args[i]) && i + 1 < args.length) {
        file = args[++i];
      } else if ("--format".equals(args[i]) && i + 1 < args.length) {
        format = args[++i];
      }
    }
    if (file == null || file.isBlank()) {
      System.err.println("Usage: java -jar mpxj-helper.jar --file <path> --format json");
      System.exit(2);
    }
    if (!"json".equalsIgnoreCase(format)) {
      System.err.println("Only --format json is supported");
      System.exit(2);
    }
    try {
      ProjectFile project = new UniversalProjectReader().read(file);
      Map<String, Object> out = toParseResult(project);
      Gson gson = new GsonBuilder().serializeNulls().create();
      System.out.print(gson.toJson(out));
    } catch (Exception e) {
      System.err.println("MPP parse failed: " + e.getMessage());
      e.printStackTrace(System.err);
      System.exit(1);
    }
  }

  static Map<String, Object> toParseResult(ProjectFile project) {
    ProjectProperties props = project.getProjectProperties();
    Map<String, Object> out = new HashMap<>();
    out.put("parserVersion", PARSER_VERSION);
    out.put("mppFileType", props.getMppFileType());
    out.put("currency", props.getCurrencySymbol());
    out.put("statusDateIso", toIso(props.getStatusDate()));

    List<Map<String, Object>> tasks = new ArrayList<>();
    for (Task task : project.getTasks()) {
      if (task == null || task.getUniqueID() == null) {
        continue;
      }
      if (task.getID() != null && task.getID() == 0 && (task.getName() == null || task.getName().isBlank())) {
        continue;
      }
      Map<String, Object> t = new HashMap<>();
      t.put("uniqueId", task.getUniqueID());
      t.put("id", task.getID());
      t.put("outlineNumber", task.getOutlineNumber());
      t.put("outlineLevel", task.getOutlineLevel() == null ? 0 : task.getOutlineLevel());
      t.put("wbs", task.getWBS());
      t.put("name", task.getName() == null ? "" : task.getName());
      t.put("isSummary", Boolean.TRUE.equals(task.getSummary()));
      t.put("isMilestone", Boolean.TRUE.equals(task.getMilestone()));
      t.put("startIso", toIso(task.getStart()));
      t.put("finishIso", toIso(task.getFinish()));
      t.put("actualStartIso", toIso(task.getActualStart()));
      t.put("actualFinishIso", toIso(task.getActualFinish()));
      t.put("durationMinutes", durationMinutes(task.getDuration(), project));
      t.put("actualDurationMinutes", durationMinutes(task.getActualDuration(), project));
      t.put("remainingDurationMinutes", durationMinutes(task.getRemainingDuration(), project));
      t.put("percentComplete", numberOrNull(task.getPercentageComplete()));
      t.put("physicalPercentComplete", numberOrNull(task.getPhysicalPercentComplete()));
      t.put("cost", numberOrNull(task.getCost()));
      t.put("companyCost", customCost(task, 2));
      t.put("financialProgressCost", customCost(task, 1));
      t.put("weight", customNumber(task, 1));
      t.put("constraintType", task.getConstraintType() == null ? null : task.getConstraintType().name());
      t.put("constraintDateIso", toIso(task.getConstraintDate()));
      t.put("deadlineIso", toIso(task.getDeadline()));
      t.put("calendarName", task.getCalendar() == null ? null : task.getCalendar().getName());
      t.put("notes", task.getNotes());
      tasks.add(t);
    }
    out.put("tasks", tasks);

    List<Map<String, Object>> deps = new ArrayList<>();
    for (Task task : project.getTasks()) {
      if (task == null || task.getUniqueID() == null) {
        continue;
      }
      List<Relation> predecessors = task.getPredecessors();
      if (predecessors == null) {
        continue;
      }
      for (Relation rel : predecessors) {
        Task pred = rel == null ? null : rel.getPredecessorTask();
        if (pred == null || pred.getUniqueID() == null) {
          continue;
        }
        Map<String, Object> d = new HashMap<>();
        d.put("predecessorUniqueId", pred.getUniqueID());
        d.put("successorUniqueId", task.getUniqueID());
        d.put("type", mapRelationType(rel.getType()));
        Double lag = durationMinutes(rel.getLag(), project);
        d.put("lagMinutes", lag == null ? 0 : lag.intValue());
        deps.add(d);
      }
    }
    out.put("dependencies", deps);

    List<Map<String, Object>> assignments = new ArrayList<>();
    for (ResourceAssignment assignment : project.getResourceAssignments()) {
      if (assignment == null || assignment.getTask() == null || assignment.getTask().getUniqueID() == null) {
        continue;
      }
      Resource resource = assignment.getResource();
      String name = resource == null ? null : resource.getName();
      if (name == null || name.isBlank()) {
        continue;
      }
      Map<String, Object> a = new HashMap<>();
      a.put("taskUniqueId", assignment.getTask().getUniqueID());
      a.put("resourceName", name);
      a.put("unitsPercent", numberOrNull(assignment.getUnits()));
      assignments.add(a);
    }
    out.put("assignments", assignments);
    return out;
  }

  private static String mapRelationType(RelationType type) {
    if (type == null) {
      return "FS";
    }
    return switch (type) {
      case START_START -> "SS";
      case FINISH_FINISH -> "FF";
      case START_FINISH -> "SF";
      default -> "FS";
    };
  }

  private static Double durationMinutes(Duration duration, ProjectFile project) {
    if (duration == null) {
      return null;
    }
    try {
      Duration minutes = duration.convertUnits(TimeUnit.MINUTES, project.getProjectProperties());
      return minutes == null ? null : minutes.getDuration();
    } catch (Exception e) {
      return null;
    }
  }

  private static Double numberOrNull(Number value) {
    return value == null ? null : value.doubleValue();
  }

  private static Double customCost(Task task, int index) {
    try {
      var method = Task.class.getMethod("getCost", int.class);
      Object value = method.invoke(task, index);
      if (value instanceof Number n) {
        return n.doubleValue();
      }
    } catch (ReflectiveOperationException ignored) {
      // unavailable
    }
    return null;
  }

  private static Double customNumber(Task task, int index) {
    try {
      var method = Task.class.getMethod("getNumber", int.class);
      Object value = method.invoke(task, index);
      if (value instanceof Number n) {
        return n.doubleValue();
      }
    } catch (ReflectiveOperationException ignored) {
      // unavailable
    }
    return null;
  }

  private static String toIso(LocalDateTime value) {
    if (value == null) {
      return null;
    }
    return value.atOffset(ZoneOffset.UTC).format(ISO);
  }

  private static String toIso(Object value) {
    if (value == null) {
      return null;
    }
    if (value instanceof LocalDateTime ldt) {
      return toIso(ldt);
    }
    if (value instanceof java.util.Date date) {
      return date.toInstant().atOffset(ZoneOffset.UTC).format(ISO);
    }
    if (value instanceof java.time.OffsetDateTime odt) {
      return odt.format(ISO);
    }
    return String.valueOf(value);
  }
}
